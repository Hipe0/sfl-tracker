class APIQueue {
  /**
   * Khởi tạo một hàng đợi để quản lý các request API
   * @param {number} concurrency Số lượng request tối đa được chạy cùng một lúc
   * @param {number} delayMs Thời gian chờ (delay) sau khi mỗi request hoàn thành trước khi gọi request tiếp theo
   */
  constructor(concurrency = 1, delayMs = 500) {
    this.concurrency = concurrency;
    this.delayMs = delayMs;
    this.queue = [];
    this.activeCount = 0;
  }

  /**
   * Thêm một task (hàm return Promise) vào hàng đợi
   * @param {Function} taskFunction Hàm thực thi tác vụ
   * @param {boolean} priority Nếu true, đẩy lên đầu hàng đợi
   * @returns {Promise<any>}
   */
  add(taskFunction, priority = false) {
    return new Promise((resolve, reject) => {
      const task = { taskFunction, resolve, reject };
      if (priority) {
        this.queue.unshift(task); // VIP: Lên đầu hàng
      } else {
        this.queue.push(task); // Thường: Xếp cuối hàng
      }
      this.processNext();
    });
  }

  getQueueStatus() {
    return {
      waiting: this.queue.length,
      active: this.activeCount,
      delayMs: this.delayMs
    };
  }

  processNext() {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.activeCount++;
    const { taskFunction, resolve, reject } = this.queue.shift();

    taskFunction()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        // Sau khi hoàn thành, đợi 1 khoảng thời gian rồi mới nhường slot cho request tiếp theo
        setTimeout(() => {
          this.activeCount--;
          this.processNext();
        }, this.delayMs);
      });
  }
}

// Cấu hình linh hoạt (đã test thực tế): 
// - API Sunflower Land giới hạn cực kì gắt (Rate limit window dài), chỉ chịu được khoảng 2-3 request mỗi vài giây. 
//   Do đó, bắt buộc để 1 request đồng thời, cách nhau 2500ms (2.5s) để an toàn nhất.
// - sfl.world API không bị Rate Limit gắt, chịu tải tốt (test 12 request/lúc vẫn OK).
//   Mỗi lần tải farm sẽ gọi 6 request phụ lên sfl.world, nên đặt concurrency = 6 để 1 farm tải chớp nhoáng,
//   delay giữa các batch chỉ cần 200ms.
const sflCommunityQueue = new APIQueue(1, 6500); // 6.5s delay to safely respect the official 1 req / 5s limit
const sflWorldQueue = new APIQueue(6, 200); 

module.exports = {
  APIQueue,
  sflCommunityQueue,
  sflWorldQueue
};
