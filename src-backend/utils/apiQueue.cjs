// Đo thật 2026-11-08 (khớp docs community API): giới hạn theo IP, mỗi endpoint ~1 request / 5–6 giây.
// Bị 429 chỉ cần chờ ~6 giây là gọi lại được, gọi dồn khi đang bị chặn KHÔNG làm bị chặn lâu hơn.
const RETRY_AFTER_429_MS = 6500;
// Hết bị 429 chừng này thì trả khoảng giãn cách về mức gốc
const RECOVER_AFTER_MS = 2 * 60 * 1000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class APIQueue {
  /**
   * Khởi tạo một hàng đợi để quản lý các request API
   * @param {number} concurrency Số lượng request tối đa được chạy cùng một lúc
   * @param {number} delayMs Khoảng cách tối thiểu giữa thời điểm bắt đầu của 2 request liên tiếp
   */
  constructor(concurrency = 1, delayMs = 500, { adaptive = false, maxDelayMs = delayMs * 4, name = 'API' } = {}) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
    // Tự giãn khi bị 429: giới hạn thật của SFL chặt hơn con số công bố và có thể dùng chung với tiến trình khác
    this.adaptive = adaptive;
    this.baseDelayMs = delayMs;
    this.maxDelayMs = maxDelayMs;
    this.name = name;
    this.pauseUntil = 0;
    this.limitedAt = 0;
    this.queue = [];
    this.activeCount = 0;
    this.lastStartAt = 0;
    this.timer = null;
  }

  /**
   * Thêm một task (hàm return Promise) vào hàng đợi
   * @param {Function} taskFunction Hàm thực thi tác vụ
   * @param {boolean} priority Nếu true, đẩy lên đầu hàng đợi
   * @returns {Promise<any>}
   */
  add(taskFunction, priority = false) {
    return new Promise((resolve, reject) => {
      const task = { taskFunction, resolve, reject, priority: !!priority };
      if (priority) {
        this.queue.unshift(task); // VIP: Lên đầu hàng
      } else {
        this.queue.push(task); // Thường: Xếp cuối hàng
      }
      this.processNext();
    });
  }

  /**
   * Có request ưu tiên (của người dùng) đang chờ không: tác vụ nền dùng để tự nhường lượt
   */
  hasPriorityWaiting() {
    return this.queue.some(task => task.priority);
  }

  getQueueStatus() {
    return {
      waiting: this.queue.length,
      active: this.activeCount,
      delayMs: this.delayMs
    };
  }

  /**
   * Bị 429: dừng cả hàng ~6,5 giây (đủ để API cho gọi lại) và giãn khoảng cách thêm 25%, tối đa maxDelayMs.
   * 2 phút không bị 429 nữa thì về lại mức gốc (trước đây phải 20 lần thành công liên tiếp mới rút 10%:
   * với ~2 request/phút thì mất hàng giờ, hàng đợi cứ chậm mãi sau vài lần bị chặn)
   */
  observe(result) {
    if (result && result.status === 429) {
      const before = this.delayMs;
      this.delayMs = Math.min(this.maxDelayMs, Math.round(this.delayMs * 1.25));
      this.limitedAt = Date.now();
      this.pauseUntil = Math.max(this.pauseUntil, this.limitedAt + Math.max(RETRY_AFTER_429_MS, this.delayMs));
      if (this.delayMs !== before) console.warn(`[${this.name}] Bị chặn 429: giãn từ ${before / 1000}s lên ${this.delayMs / 1000}s/request, thử lại sau ${RETRY_AFTER_429_MS / 1000}s`);
    }
  }

  /** Về lại khoảng giãn cách gốc khi đã lâu không bị 429 */
  recover(now = Date.now()) {
    if (this.delayMs > this.baseDelayMs && now - this.limitedAt >= RECOVER_AFTER_MS) {
      this.delayMs = this.baseDelayMs;
      console.log(`[${this.name}] ${RECOVER_AFTER_MS / 60000} phút không bị 429: về lại ${this.baseDelayMs / 1000}s/request`);
    }
  }

  /**
   * Gọi API qua hàng đợi, bị 429 thì tự thử lại (mặc định 2 lần, mỗi lần chờ ~6,5 giây, xếp lên đầu hàng).
   * doFetch: hàm trả về Promise<Response>. Trả về Response cuối cùng (vẫn có thể là 429 nếu hết lượt thử).
   */
  async request(doFetch, { priority = false, retries = 2 } = {}) {
    let res = await this.add(doFetch, priority);
    for (let i = 0; i < retries && res && res.status === 429; i++) {
      res.body?.cancel?.().catch(() => {});
      // Hàng đợi thích ứng đã tự dừng ~6,5 giây trong observe(); hàng thường thì tự chờ
      if (!this.adaptive) await sleep(RETRY_AFTER_429_MS);
      res = await this.add(doFetch, true);
    }
    return res;
  }

  processNext() {
    if (this.timer || this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    if (this.adaptive) this.recover();
    // Giãn cách tính từ lúc request trước BẮT ĐẦU (không cộng thêm thời gian chờ phản hồi),
    // nên tốc độ gọi API vẫn không vượt 1 request / delayMs nhưng người dùng chờ ít hơn
    const wait = Math.max(this.lastStartAt + this.delayMs, this.pauseUntil) - Date.now();
    if (wait > 0) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.processNext();
      }, wait);
      return;
    }

    this.activeCount++;
    this.lastStartAt = Date.now();
    const { taskFunction, resolve, reject } = this.queue.shift();

    Promise.resolve()
      .then(taskFunction)
      .then(result => {
        if (this.adaptive) this.observe(result);
        return result;
      })
      .then(resolve, reject)
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }
}

// Cấu hình linh hoạt (đã test thực tế): 
// - API Sunflower Land giới hạn cực kì gắt (Rate limit window dài), chỉ chịu được khoảng 2-3 request mỗi vài giây. 
//   Do đó, bắt buộc để 1 request đồng thời, cách nhau 2500ms (2.5s) để an toàn nhất.
// - sfl.world API không bị Rate Limit gắt, chịu tải tốt (test 12 request/lúc vẫn OK).
//   Mỗi lần tải farm sẽ gọi 6 request phụ lên sfl.world, nên đặt concurrency = 6 để 1 farm tải chớp nhoáng,
//   delay giữa các batch chỉ cần 200ms.
// 5.5s/request (docs: ~1 request / 5 giây mỗi IP mỗi endpoint, "doubling to 10 seconds" nếu cứ dồn).
// Bị 429 thì giãn dần tới tối đa 10s, 2 phút không bị nữa thì về 5.5s
const sflCommunityQueue = new APIQueue(1, 5500, { adaptive: true, maxDelayMs: 10000, name: 'SFL API' });
const sflWorldQueue = new APIQueue(6, 200);
// /visit là API công khai của game (không dùng API key), không chung giới hạn với community API:
// tách hàng riêng để tải farm gọi song song với /community/farms
const sflVisitQueue = new APIQueue(1, 2000);

module.exports = {
  RETRY_AFTER_429_MS,
  APIQueue,
  sflCommunityQueue,
  sflWorldQueue,
  sflVisitQueue
};
