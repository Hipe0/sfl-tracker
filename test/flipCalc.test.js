import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { computeFlip, getTradeSide } = require('../src-backend/services/flipCalc.cjs');

const ME = 1;
const OTHER = 2;
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 1, 0, 0, 0);

let seq = 0;
// Mua qua listing: người khác treo bán, mình khớp
const buy = (item, qty, sfl, t) => ({
  id: `b${++seq}`, itemName: item, quantity: qty, sfl, fulfilledAt: t,
  source: 'listing', initiatedBy: { id: OTHER }, fulfilledBy: { id: ME }
});
// Bán qua listing: mình treo bán, người khác khớp
const sell = (item, qty, sfl, t, extra = {}) => ({
  id: `s${++seq}`, itemName: item, quantity: qty, sfl, fulfilledAt: t,
  source: 'listing', initiatedBy: { id: ME }, fulfilledBy: { id: OTHER }, ...extra
});

const run = (trades, opts = {}) => computeFlip(trades, {
  farmId: ME,
  resolveName: t => t.itemName,
  taxRateFor: t => (t.taxRateAtTrade ?? 0.1),
  ...opts
});

describe('getTradeSide', () => {
  it('nhận biết bên mua/bán theo nguồn listing và offer', () => {
    expect(getTradeSide({ source: 'listing', initiatedBy: { id: 1 }, fulfilledBy: { id: 2 } }, 1)).toBe('sell');
    expect(getTradeSide({ source: 'listing', initiatedBy: { id: 2 }, fulfilledBy: { id: 1 } }, 1)).toBe('buy');
    expect(getTradeSide({ source: 'offer', initiatedBy: { id: 1 }, fulfilledBy: { id: 2 } }, '1')).toBe('buy');
    expect(getTradeSide({ source: 'offer', initiatedBy: { id: 2 }, fulfilledBy: { id: 1 } }, 1)).toBe('sell');
    expect(getTradeSide({ source: 'offer', initiatedBy: { id: 3 }, fulfilledBy: { id: 2 } }, 1)).toBeNull();
  });
});

describe('computeFlip', () => {
  it('ghép FIFO qua nhiều lô và trừ thuế', () => {
    const r = run([
      buy('Onion', 100, 1, T0),            // 0.01 / cái
      buy('Onion', 100, 2, T0 + DAY),      // 0.02 / cái
      sell('Onion', 150, 4.5, T0 + 3 * DAY) // 0.03 / cái, thuế 10%
    ]);
    expect(r.lots).toHaveLength(2);
    const [a, b] = r.lots;
    expect(a.qty).toBe(100);
    expect(a.cost).toBeCloseTo(1);
    expect(a.proceeds).toBeCloseTo(2.7);
    expect(a.holdDays).toBeCloseTo(3);
    expect(b.qty).toBe(50);
    expect(b.cost).toBeCloseTo(1);
    expect(b.proceeds).toBeCloseTo(1.35);

    const onion = r.resources[0];
    expect(onion.realizedProfit).toBeCloseTo(2.05);
    expect(onion.taxPaid).toBeCloseTo(0.45);
    expect(onion.soldAfterTax).toBeCloseTo(4.05);
    expect(onion.avgSellPrice).toBeCloseTo(0.03);
    expect(onion.roi).toBeCloseTo(2.05 / 2);
    expect(onion.lotsUsed).toBe(2);
    expect(onion.wins).toBe(2);
    // Còn 50 cái của lô thứ hai đang giữ
    expect(onion.openQty).toBe(50);
    expect(onion.openCost).toBeCloseTo(1);
    expect(r.summary.winRate).toBe(1);
    // Giữ trung bình theo số lượng: (100*3 + 50*2) / 150
    expect(r.summary.avgHoldDays).toBeCloseTo(400 / 150);
  });

  it('phần bán không có lô mua tính vào non-flip, không tính vào lãi', () => {
    const r = run([
      buy('Kale', 10, 1, T0),
      sell('Kale', 15, 3, T0 + DAY, { taxRateAtTrade: 0 })
    ]);
    const kale = r.resources[0];
    expect(kale.matchedQty).toBe(10);
    expect(kale.nonFlipQty).toBe(5);
    expect(kale.nonFlipAfterTax).toBeCloseTo(1);
    expect(kale.realizedProfit).toBeCloseTo(1);
    expect(r.summary.nonFlipAfterTax).toBeCloseTo(1);
  });

  it('không ghép với lô mua sau thời điểm bán', () => {
    const r = run([
      sell('Rice', 5, 1, T0),
      buy('Rice', 5, 0.5, T0 + DAY)
    ]);
    expect(r.lots).toHaveLength(0);
    expect(r.resources[0].nonFlipQty).toBe(5);
    expect(r.resources[0].openQty).toBe(5);
  });

  it('lọc khoảng ngày vẫn dùng lô mua từ trước khoảng đó', () => {
    const r = run([
      buy('Barley', 10, 1, T0),
      sell('Barley', 10, 2, T0 + 10 * DAY, { taxRateAtTrade: 0 })
    ], { from: T0 + 5 * DAY });
    expect(r.summary.bought).toBe(0);
    expect(r.summary.realizedProfit).toBeCloseTo(1);
    expect(r.lots[0].holdDays).toBeCloseTo(10);
  });

  it('tính lãi chưa thực hiện theo giá thị trường sau thuế', () => {
    const r = run([buy('Radish', 10, 1, T0)], {
      marketPrices: { Radish: 0.2 },
      currentTaxRateFor: () => 0.5
    });
    expect(r.openLots[0].marketValueAfterTax).toBeCloseTo(1);
    expect(r.summary.unrealizedProfit).toBeCloseTo(0);
  });

  it('lệnh lỗ được đếm là thua, lãi luỹ kế theo ngày UTC+7', () => {
    const r = run([
      buy('Turnip', 10, 2, T0),
      sell('Turnip', 10, 1, T0 + 18 * 60 * 60 * 1000, { taxRateAtTrade: 0 }) // 18:00 UTC = 01:00 hôm sau ở UTC+7
    ]);
    expect(r.summary.losses).toBe(1);
    expect(r.summary.winRate).toBe(0);
    const sellDay = r.daily.find(d => d.realizedProfit !== 0);
    expect(sellDay.date).toBe('2026-09-02');
    expect(sellDay.cumulativeProfit).toBeCloseTo(-1);
  });

  it('bỏ qua giao dịch không liên quan và vật phẩm bị loại', () => {
    const r = run([
      { ...buy('Onion', 1, 1, T0), fulfilledBy: { id: OTHER } },
      buy('Gnome', 1, 5, T0)
    ], { includeItem: name => name !== 'Gnome' });
    expect(r.resources).toHaveLength(0);
  });
});

describe('computeFlip: hàng mua về rồi dùng một phần', () => {
  const all = () => true;

  it('kho đồ ít hơn lô mua còn lại: phần chênh là đã dùng, không tính lãi/lỗ', () => {
    const r = run([
      buy('Barley', 100, 10, T0),            // 0.1 / cái
      sell('Barley', 30, 6, T0 + DAY)        // 0.2 / cái, thuế 10%
    ], { inventory: { Barley: 20 }, tracksInventory: all, marketPrices: { Barley: 0.2 } });
    const res = r.resources[0];
    // Lãi chỉ tính trên 30 cái đã bán
    expect(res.realizedProfit).toBeCloseTo(30 * 0.18 - 30 * 0.1);
    // Còn 70 cái trong lô, kho chỉ có 20: 50 cái đã dùng
    expect(res.usedQty).toBeCloseTo(50);
    expect(res.usedCost).toBeCloseTo(5);
    expect(res.openQty).toBeCloseTo(20);
    expect(res.openCost).toBeCloseTo(2);
    expect(res.unrealizedProfit).toBeCloseTo(20 * 0.2 - 2);
    expect(r.summary.usedCost).toBeCloseTo(5);
    expect(r.openLots).toHaveLength(1);
  });

  it('dùng lô cũ nhất trước', () => {
    const r = run([
      buy('Barley', 10, 1, T0),              // 0.1 / cái
      buy('Barley', 10, 3, T0 + DAY)         // 0.3 / cái
    ], { inventory: { Barley: 5 }, tracksInventory: all });
    expect(r.resources[0].usedQty).toBeCloseTo(15);
    expect(r.resources[0].usedCost).toBeCloseTo(1 + 5 * 0.3);
    expect(r.openLots[0]).toMatchObject({ qty: 5, buyPrice: 0.3 });
  });

  it('kho đồ nhiều hơn lô mua (có đồ tự farm) thì không trừ gì', () => {
    const r = run([buy('Barley', 10, 1, T0)], { inventory: { Barley: 50 }, tracksInventory: all });
    expect(r.resources[0].usedQty).toBe(0);
    expect(r.resources[0].openQty).toBe(10);
  });

  it('không có kho đồ hoặc món không theo dõi thì giữ nguyên lô', () => {
    const trades = [buy('Gnome', 1, 5, T0)];
    expect(run(trades).resources[0].openQty).toBe(1);
    expect(run(trades, { inventory: {}, tracksInventory: () => false }).resources[0].openQty).toBe(1);
  });
});

describe('computeFlip: phiên theo từng vật phẩm', () => {
  it('mỗi vật phẩm chỉ đếm lệnh khớp từ lúc mở phiên của nó, vẫn ghép với lô mua trước phiên', () => {
    const r = run([
      buy('Barley', 10, 1, T0),              // trước phiên
      buy('Onion', 10, 1, T0),
      sell('Barley', 10, 2, T0 + 2 * DAY),
      sell('Onion', 10, 2, T0 + 2 * DAY)
    ], {
      includeItem: name => name !== 'Kale',
      fromFor: name => (name === 'Barley' ? T0 + DAY : T0 + 3 * DAY)
    });
    const barley = r.resources.find(x => x.item === 'Barley');
    expect(barley.boughtQty).toBe(0);
    expect(barley.soldQty).toBe(10);
    expect(barley.realizedProfit).toBeCloseTo(2 * 0.9 - 1);
    // Onion mở phiên sau lệnh bán: chưa có gì được tính
    expect(r.resources.find(x => x.item === 'Onion')).toBeUndefined();
  });
});
