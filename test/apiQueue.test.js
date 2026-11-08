import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { APIQueue } = require('../src-backend/utils/apiQueue.cjs');

afterEach(() => {
  vi.useRealTimers();
});

describe('APIQueue', () => {
  it('giãn cách theo thời điểm bắt đầu, không cộng thời gian chờ phản hồi', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 5000);
    const starts = [];
    // Mỗi request mất 2 giây mới trả về
    const task = () => {
      starts.push(Date.now());
      return new Promise(resolve => setTimeout(resolve, 2000));
    };
    const t0 = Date.now();
    const all = Promise.all([q.add(task), q.add(task), q.add(task)]);
    await vi.advanceTimersByTimeAsync(20000);
    await all;
    expect(starts.map(t => t - t0)).toEqual([0, 5000, 10000]);
  });

  it('request chậm hơn khoảng giãn cách vẫn không chạy chồng nhau', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 1000);
    const starts = [];
    const task = () => {
      starts.push(Date.now());
      return new Promise(resolve => setTimeout(resolve, 3000));
    };
    const t0 = Date.now();
    const all = Promise.all([q.add(task), q.add(task)]);
    await vi.advanceTimersByTimeAsync(10000);
    await all;
    expect(starts.map(t => t - t0)).toEqual([0, 3000]);
  });

  it('request ưu tiên được chạy trước các request đang chờ', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 1000);
    const order = [];
    const task = name => () => { order.push(name); return Promise.resolve(name); };
    const all = Promise.all([q.add(task('a')), q.add(task('b')), q.add(task('vip'), true)]);
    await vi.advanceTimersByTimeAsync(5000);
    await all;
    expect(order).toEqual(['a', 'vip', 'b']);
  });

  it('lỗi của một request không làm kẹt hàng đợi', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 100);
    const failing = q.add(() => Promise.reject(new Error('boom')));
    const next = q.add(() => Promise.resolve('ok'));
    await expect(failing).rejects.toThrow('boom');
    await vi.advanceTimersByTimeAsync(200);
    await expect(next).resolves.toBe('ok');
    expect(q.getQueueStatus()).toMatchObject({ waiting: 0, active: 0 });
  });

  it('hàng rảnh lâu hơn khoảng giãn cách thì chạy ngay', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 1000);
    await q.add(() => Promise.resolve(1));
    await vi.advanceTimersByTimeAsync(1500);
    const start = Date.now();
    let startedAt = null;
    await q.add(() => { startedAt = Date.now(); return Promise.resolve(2); });
    expect(startedAt - start).toBe(0);
  });

  it('request(): bị 429 thì tự thử lại sau ~6,5 giây, xếp lên đầu hàng', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 5000, { adaptive: true, maxDelayMs: 10000, name: 'T' });
    const statuses = [429, 200];
    const starts = [];
    const doFetch = () => { starts.push(Date.now()); return Promise.resolve({ status: statuses.shift() }); };
    const t0 = Date.now();
    const p = q.request(doFetch);
    await vi.advanceTimersByTimeAsync(10000);
    const res = await p;
    expect(res.status).toBe(200);
    expect(starts.map(t => t - t0)).toEqual([0, 6500]);
    expect(q.delayMs).toBe(6250);
  });

  it('request(): hết lượt thử vẫn 429 thì trả về 429 để nơi gọi tự lùi lịch', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 5000, { adaptive: true, maxDelayMs: 10000, name: 'T' });
    let n = 0;
    const p = q.request(() => { n++; return Promise.resolve({ status: 429 }); });
    await vi.advanceTimersByTimeAsync(30000);
    expect((await p).status).toBe(429);
    expect(n).toBe(3);
    expect(q.delayMs).toBeLessThanOrEqual(10000);
  });

  it('2 phút không bị 429 thì khoảng giãn cách về lại mức gốc', async () => {
    vi.useFakeTimers();
    const q = new APIQueue(1, 5000, { adaptive: true, maxDelayMs: 10000, name: 'T' });
    await q.request(() => Promise.resolve({ status: 429 }), { retries: 0 });
    expect(q.delayMs).toBe(6250);
    await vi.advanceTimersByTimeAsync(121000);
    await q.add(() => Promise.resolve({ status: 200 }));
    expect(q.delayMs).toBe(5000);
  });
});
