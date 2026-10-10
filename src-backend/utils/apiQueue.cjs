class APIQueue {
  /**
   * Khởi tạo một hàng đợi để quản lý các request API
   * @param {number} concurrency Số lượng request tối đa được chạy cùng một lúc
   * @param {number} delayMs Khoảng cách tối thiểu giữa thời điểm bắt đầu của 2 request liên tiếp
   */
  constructor(concurrency = 1, delayMs = 500) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
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

  processNext() {
    if (this.timer || this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    // Giãn cách tính từ lúc request trước BẮT ĐẦU (không cộng thêm thời gian chờ phản hồi),
    // nên tốc độ gọi API vẫn không vượt 1 request / delayMs nhưng người dùng chờ ít hơn
    const wait = this.lastStartAt + this.delayMs - Date.now();
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
const sflCommunityQueue = new APIQueue(1, 5500); // 5.5s delay to safely respect the official 1 req / 5s limit
const sflWorldQueue = new APIQueue(6, 200);
// /visit là API công khai của game (không dùng API key), không chung giới hạn với community API:
// tách hàng riêng để tải farm gọi song song với /community/farms
const sflVisitQueue = new APIQueue(1, 2000);

module.exports = {
  APIQueue,
  sflCommunityQueue,
  sflWorldQueue,
  sflVisitQueue
};
