import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { fetchProfileShared, getProfileCallStats } = require('../src-backend/services/flipService.cjs');

describe('fetchProfileShared', () => {
  it('gọi chung 1 lần, dùng lại trong 45s, bị 429 thì không gọi tiếp', async () => {
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
});
