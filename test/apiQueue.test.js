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
});
