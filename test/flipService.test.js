import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let svc;
beforeAll(() => {
  // db.cjs thoát process nếu thiếu MONGODB_URI; client chỉ kết nối khi initDB() được gọi
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:1/test';
  svc = require('../src-backend/services/flipService.cjs');
});

const mk = (n, start) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, fulfilledAt: start + i * 1000 }));

describe('detectGap', () => {
  it('có lệnh chồng lên dữ liệu cũ thì không sót', () => {
    expect(svc.detectGap({ trades: mk(50, 5000), newCount: 30, lastStoredAt: 4000, lastTotalTrades: 100, totalTrades: 130 })).toBeNull();
  });

  it('cả 50 lệnh đều mới: tính số lệnh sót từ totalTrades', () => {
    const gap = svc.detectGap({ trades: mk(50, 5000), newCount: 50, lastStoredAt: 1000, lastTotalTrades: 100, totalTrades: 170 });
    expect(gap).toEqual({ from: 1000, to: 5000, missingCount: 20 });
  });

  it('totalTrades khớp đúng 50 lệnh mới thì không sót', () => {
    expect(svc.detectGap({ trades: mk(50, 5000), newCount: 50, lastStoredAt: 1000, lastTotalTrades: 100, totalTrades: 150 })).toBeNull();
  });

  it('chưa biết totalTrades lần trước thì vẫn cảnh báo, số lệnh sót để trống', () => {
    expect(svc.detectGap({ trades: mk(50, 5000), newCount: 50, lastStoredAt: 1000, lastTotalTrades: null, totalTrades: 170 }))
      .toEqual({ from: 1000, to: 5000, missingCount: null });
  });

  it('farm chưa có giao dịch nào trong DB thì không coi là sót', () => {
    expect(svc.detectGap({ trades: mk(50, 5000), newCount: 50, lastStoredAt: null, lastTotalTrades: null, totalTrades: 50 })).toBeNull();
  });
});

describe('lệnh nhập tay', () => {
  it('kiểm tra dữ liệu đầu vào', () => {
    const ok = svc.validateAdjustment({ item: 'Sunflower', side: 'buy', qty: '14000', price: '0.0005', at: '2026-10-10T14:00:00Z' });
    expect(ok.errors).toEqual([]);
    expect(ok.value).toMatchObject({ item: 'Sunflower', side: 'buy', qty: 14000, price: 0.0005 });
    const bad = svc.validateAdjustment({ item: '', side: 'hold', qty: 0, price: -1, at: 'x' });
    expect(bad.errors).toEqual(['item', 'side', 'qty', 'price', 'at']);
    expect(svc.validateAdjustment({ item: 'Kale', side: 'buy', qty: 1, at: 1 }).errors).toEqual(['price']);
    expect(svc.validateAdjustment({ qty: 5 }, true).errors).toEqual([]);
  });

  it('lệnh bán nhập tay giữ giá trước thuế kèm mức thuế; lệnh ước tính đã là sau thuế', () => {
    const manual = svc.adjustmentToTrade({ _id: 'a1', item: 'Kale', side: 'sell', qty: 10, price: 0.2, sfl: 2, taxRate: 0.15, at: 5, source: 'manual' }, '42');
    expect(manual).toMatchObject({ itemName: 'Kale', quantity: 10, sfl: 2, taxRateAtTrade: 0.15, initiatedBy: { id: 42 }, flipSource: 'manual' });
    const est = svc.adjustmentToTrade({ _id: 'a2', item: 'Kale', side: 'sell', qty: 10, sfl: 1.7, at: 5, source: 'estimate' }, '42');
    expect(est.taxRateAtTrade).toBe(0);
  });
});
