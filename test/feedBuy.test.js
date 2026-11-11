import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { feedSignal, backtestFeed } = require('../src-backend/domain/feedBuy.cjs');
const { slotOf } = require('../src-backend/domain/seasonCycle.cjs');

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2025-12-16T12:00:00Z'); // thứ Ba, tuần đầu mùa xuân

/** Giá 1, mùa thu rẻ hơn 12% (giống Barley/Wheat: rẻ mùa thu chứ không phải mùa xuân), nhiễu nhẹ ±1% */
function series(n) {
  return Array.from({ length: n }, (_, i) => {
    const ts = START + i * DAY;
    const slot = slotOf(ts);
    const autumn = slot >= 14 && slot < 21;
    return { date: new Date(ts).toISOString().slice(0, 10), close: (autumn ? 0.88 : 1) * (1 + 0.01 * Math.sin(i)) };
  });
}
const nowAtSlot = (daily, slot) => {
  const row = daily.filter(d => slotOf(Date.parse(`${d.date}T12:00:00Z`)) === slot).pop();
  return { ts: Date.parse(`${row.date}T12:00:00Z`), row };
};

describe('feedSignal (mua trữ theo khúc rẻ của chính món đó)', () => {
  const daily = series(200);

  it('đang trong mùa rẻ → Mua trữ, còn mấy ngày', () => {
    const { ts, row } = nowAtSlot(daily, 15);
    const r = feedSignal(daily.filter(d => d.date <= row.date), { now: ts, price: row.close });
    expect(r.decision).toBe('buy');
    expect(r.inWindow).toBe(true);
    expect(r.windowSeasons).toEqual(['autumn']);
    expect(r.windowLeftDays).toBeGreaterThan(0);
    expect(r.windowEndDate >= row.date).toBe(true);
    expect(r.reason).toContain('Khúc rẻ sau');
  });

  it('mùa xuân không rẻ với món này → Chờ, hẹn mùa thu, giá dự kiến thấp hơn bây giờ', () => {
    const { ts, row } = nowAtSlot(daily, 3);
    const r = feedSignal(daily.filter(d => d.date <= row.date), { now: ts, price: row.close });
    expect(r.decision).toBe('wait');
    // Hồ sơ làm mượt 3 ngày nên ngày đầu mùa thu (giáp mùa hè) chưa vào khúc rẻ
    const next = slotOf(Date.parse(`${r.nextDate}T12:00:00Z`));
    expect(next).toBeGreaterThanOrEqual(14);
    expect(next).toBeLessThan(21);
    expect(r.cheaperPct).toBeGreaterThan(0.08);
    expect(r.reason).toContain('mùa thu');
    // Khúc rẻ hiện thành khoảng ngày có thứ, vd "T5 19/11 → T3 24/11"
    expect(r.nextEndDate >= r.nextDate).toBe(true);
    expect(r.reason).toMatch(/T\d|CN/);
    expect(r.reason).toContain('→');
  });

  it('ngoài khúc rẻ mà giá đã xuống tới đáy dự kiến → Mua trữ', () => {
    const { ts, row } = nowAtSlot(daily, 3);
    const r = feedSignal(daily.filter(d => d.date <= row.date), { now: ts, price: 0.85 });
    expect(r.decision).toBe('buy');
    expect(r.inWindow).toBe(false);
  });

  it('chưa đủ dữ liệu → Chưa rõ', () => {
    expect(feedSignal(series(30), { now: START + 29 * DAY }).decision).toBe('unknown');
    expect(feedSignal([], {}).decision).toBe('unknown');
  });
});

describe('backtestFeed', () => {
  it('mua theo khúc rẻ rẻ hơn mua đều mỗi ngày ở mọi vòng', () => {
    const r = backtestFeed(series(330));
    expect(r.cycles).toBeGreaterThanOrEqual(6);
    expect(r.winCycles).toBe(r.cycles);
    expect(r.avgSaving).toBeGreaterThan(0.05);
  });
});
