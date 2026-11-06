import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { listState, listingsByItem } = require('../src-backend/services/marketService.cjs');

describe('listState (khoảng giá list floor ±20%)', () => {
  it('giá treo trong khoảng → có thể list', () => {
    const r = listState({ ask: 0.01948, floor: 0.01700 });
    expect(r.state).toBe('can_list');
    expect(r.max).toBe(0.0204);
  });
  it('giá treo vượt trần → chờ, báo giá sàn cần đạt', () => {
    const r = listState({ ask: 0.01701, floor: 0.0138 });
    expect(r.state).toBe('wait');
    expect(r.max).toBe(0.0166);
    expect(r.needFloor).toBeCloseTo(0.014175, 6);
  });
  it('giá rất nhỏ so sánh sau khi làm tròn 4 số như game', () => {
    // 0.0002 × 1.2 = 0.00024 → 0.0002; giá treo 0.0002138 → 0.0002: game vẫn cho list
    expect(listState({ ask: 0.0002138, floor: 0.0002 }).state).toBe('can_list');
  });
  it('đã có lệnh treo từ API hoặc tự đánh dấu → đã list', () => {
    expect(listState({ ask: 1, floor: 0.5, listed: { qty: 10, count: 1, unitPrice: 0.6 } })).toMatchObject({ state: 'listed', source: 'api' });
    expect(listState({ ask: 1, floor: 0.5, marked: 123 })).toMatchObject({ state: 'listed', source: 'manual' });
  });
  it('gom lệnh treo theo món', () => {
    const r = listingsByItem({ trades: { listings: {
      a: { items: { Sunflower: 4000 }, sfl: 0.82 }, b: { items: { Sunflower: 4000 }, sfl: 0.8 }, c: { items: { 'Vampire Coffin': 1 }, sfl: 14 }
    } } });
    expect(r.Sunflower).toMatchObject({ qty: 8000, count: 2 });
    expect(r.Sunflower.unitPrice).toBeCloseTo(0.0002, 7);
  });
});
