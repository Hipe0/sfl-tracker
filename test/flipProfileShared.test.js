import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { fetchProfileShared, getProfileCallStats } = require('../src-backend/services/flipService.cjs');

describe('fetchProfileShared', () => {
  it('gọi chung 1 lần, dùng lại trong 15s, bị 429 thì không gọi tiếp', async () => {
    let calls = 0;
    const ok = { fetchProfile: async () => { calls++; return { trades: [] }; } };
    const [a, b] = await Promise.all([fetchProfileShared('t1', ok), fetchProfileShared('t1', ok)]);
    expect(a).toBe(b);
    await fetchProfileShared('t1', ok);
    expect(calls).toBe(1);

    let calls2 = 0;
    const limited = { fetchProfile: async () => { calls2++; throw new Error('Marketplace Profile API Error: 429'); } };
    await expect(fetchProfileShared('t2', limited)).rejects.toThrow('429');
    await expect(fetchProfileShared('t2', limited)).rejects.toThrow('429');
    expect(calls2).toBe(1);
    expect(getProfileCallStats().total).toBe(2);
  });

  it('lần trước lỗi mạng (không có dữ liệu) thì chờ đủ 15s rồi gọi lại, không báo 429 giả', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const flaky = { fetchProfile: async () => { calls++; if (calls === 1) throw new Error('fetch failed'); return { trades: [1] }; } };
    await expect(fetchProfileShared('t3', flaky)).rejects.toThrow('fetch failed');
    const p = fetchProfileShared('t3', flaky);
    await vi.advanceTimersByTimeAsync(16000);
    await expect(p).resolves.toEqual({ trades: [1] });
    expect(calls).toBe(2);
    vi.useRealTimers();
  });
});
