import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { findPeaks, stockSignal, backtestStock, cleanSeries } = require('../src-backend/domain/stockPeaks.cjs');

const DAY = 24 * 60 * 60 * 1000;
const start = Date.parse('2026-01-01T00:00:00Z');
const day = i => new Date(start + i * DAY).toISOString().slice(0, 10);

/**
 * Giá nền `base` dao động nhẹ (±2%, chu kỳ 5 ngày), cứ mỗi `every` ngày có 1 đỉnh cao gấp `spike` lần trong 1 ngày.
 * drift: nền trôi theo ngày (âm = giảm dần)
 */
function series(n, { base = 1, spike = 1.3, every = 30, first = 40, drift = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const b = base * (1 + drift * i) * (1 + 0.02 * Math.sin((2 * Math.PI * i) / 5));
    const isPeak = i >= first && (i - first) % every === 0;
    return { date: day(i), close: isPeak ? b * spike : b };
  });
}

describe('findPeaks', () => {
  it('tìm đúng các đỉnh tăng mạnh, bỏ đỉnh chưa qua đủ 7 ngày xác nhận', () => {
    const s = cleanSeries(series(135)); // đỉnh ở ngày 40, 70, 100, 130 (130 + 7 > 134: chưa xác nhận)
    const peaks = findPeaks(s, { minRatio: 1.15 });
    expect(peaks.map(p => p.date)).toEqual([day(40), day(70), day(100)]);
    expect(peaks[0].ratio).toBeGreaterThan(1.25);
  });
  it('dao động nhỏ dưới ngưỡng không tính là đỉnh', () => {
    const s = cleanSeries(series(150, { spike: 1.08 }));
    expect(findPeaks(s, { minRatio: 1.1 })).toHaveLength(0);
  });
});

describe('stockSignal', () => {
  const s = series(200); // đỉnh 40, 70, ..., 190
  it('giá thường → Giữ; mức bán = nền × ngưỡng tăng mạnh (≥ +10%), đỉnh TB cao hơn mức bán', () => {
    const r = stockSignal(s, { price: 1 });
    expect(r.decision).toBe('hold');
    expect(r.base).toBeCloseTo(1, 1);
    expect(r.spikeRatio).toBeGreaterThanOrEqual(1.1);
    expect(r.target).toBeCloseTo(r.base * r.spikeRatio);
    expect(r.peakTarget).toBeGreaterThan(r.target);
    expect(r.peakCount).toBeGreaterThanOrEqual(4);
  });
  it('giá lên tới mức bán → Bán; còn dưới 5% → Sắp tới đỉnh', () => {
    const r = stockSignal(s, { price: 1 });
    expect(stockSignal(s, { price: r.target * 1.001 }).decision).toBe('sell');
    expect(stockSignal(s, { price: r.target * 0.97 }).decision).toBe('near');
  });
  it('luật avgpeak: chỉ bán khi chạm đỉnh TB', () => {
    const p = stockSignal(s, { price: 1 });
    const mid = (p.target + p.peakTarget) / 2;
    expect(stockSignal(s, { price: mid }).decision).toBe('sell');
    expect(stockSignal(s, { price: mid, rule: 'avgpeak' }).decision).not.toBe('sell');
    expect(stockSignal(s, { price: p.peakTarget * 1.01, rule: 'avgpeak' }).decision).toBe('sell');
  });
  it('mức bán theo nền hiện tại chứ không theo giá đỉnh tuyệt đối cũ (giá trôi xuống)', () => {
    const r = stockSignal(series(220, { drift: -0.002 }), { price: 0.6 });
    expect(r.peakTarget).toBeLessThan(r.avgPeakPrice);
    expect(r.peakTarget / r.base).toBeGreaterThan(1.2);
  });
  it('chưa đủ 60 ngày lịch sử → Chưa rõ', () => {
    const r = stockSignal(series(70), { price: 1 }); // nền cần 15 ngày → mới có 54 ngày tỉ lệ
    expect(r.decision).toBe('unknown');
    expect(r.target).toBeNull();
    expect(stockSignal([], {}).decision).toBe('unknown');
  });
});

describe('backtestStock', () => {
  it('chuỗi có đỉnh đều: bán theo luật được giá cao hơn bán đều mỗi ngày', () => {
    const r = backtestStock(series(300));
    expect(r.sellDays).toBeGreaterThan(0);
    expect(r.ratioWithUnsold).toBeGreaterThan(1.1);
  });
});
