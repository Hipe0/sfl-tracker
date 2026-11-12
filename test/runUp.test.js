import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { runUpOf } = require('../src-backend/domain/seasonCycle.cjs');

const DAY = 86400000;
const now = Date.parse('2026-11-12T12:00:00Z');
const day = k => new Date(now - k * DAY).toISOString().slice(0, 10);

describe('runUpOf', () => {
  it('đo giá hiện tại so với giá đóng thấp nhất 14 ngày', () => {
    const daily = [20, 10, 12, 11].map((close, i) => ({ date: day(4 - i), close }));
    const r = runUpOf(daily, 13, now, 14);
    expect(r.low).toBe(10);
    expect(r.runUp).toBeCloseTo(0.3);
  });
  it('bỏ qua giá cũ hơn cửa sổ và tính cả giá hiện tại', () => {
    const daily = [{ date: day(30), close: 1 }, { date: day(2), close: 10 }];
    expect(runUpOf(daily, 8, now, 14)).toEqual({ runUp: 0, low: 8 });
  });
  it('không có dữ liệu thì trả null', () => {
    expect(runUpOf([], 5, now, 14)).toEqual({ runUp: null, low: null });
  });
});
