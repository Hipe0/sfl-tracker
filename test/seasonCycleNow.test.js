import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { cyclePlan, slotOf } = require('../src-backend/domain/seasonCycle.cjs');

const DAY = 864e5;
const iso = ts => new Date(ts).toISOString().slice(0, 10);
// Giá theo mùa: đông (ô 21-27) đắt hơn 30%, còn lại 1.0
const seasonal = ts => (slotOf(ts) >= 21 ? 1.3 : 1);

function series(endTs, lastClose) {
  const rows = [];
  for (let t = endTs - 300 * DAY; t < endTs; t += DAY) rows.push({ date: iso(t), close: seasonal(t + 12 * 3600e3) });
  rows.push({ date: iso(endTs), close: lastClose });
  return rows;
}

describe('cyclePlan chế độ mua ngay', () => {
  // ngày cuối thu: vài ngày nữa vào đông
  let end = Date.parse('2026-11-03T00:00:00Z');
  while (slotOf(end + 12 * 3600e3) !== 18) end += DAY;

  it('giá bán mục tiêu không nhân từ giá hôm nay và không vượt đỉnh 90 ngày', () => {
    const p = cyclePlan(series(end, 1), end + 12 * 3600e3, { mode: 'now' });
    expect(p.sellPrice).toBeLessThanOrEqual(p.high90 + 1e-9);
    const ranUp = cyclePlan(series(end, 1.25), end + 12 * 3600e3, { mode: 'now' });
    // giá đã chạy lên 25% trước mùa: giá bán mục tiêu không bị đẩy theo (cách cũ sẽ ra ~1.25 × 1.3)
    expect(ranUp.sellPrice).toBeLessThanOrEqual(1.31);
    expect(ranUp.netMargin).toBeLessThan(p.netMargin);
  });
});
