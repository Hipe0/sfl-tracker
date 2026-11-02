import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { reconcileGap } = require('../src-backend/services/flipReconcile.cjs');
const sched = require('../src-backend/services/flipScheduler.cjs');

const tradeable = name => ['Sunflower', 'Potato', 'Kale'].includes(name);
const prices = { Sunflower: 0.0005, Potato: 0.0004, Kale: 0.02 };
const refPrice = item => prices[item] ?? null;

describe('reconcileGap', () => {
  it('bù đúng số lượng và tiền thiếu khi chỉ một món', () => {
    const r = reconcileGap({
      before: { at: 0, balance: 100, inventory: { Sunflower: 0 } },
      after: { at: 60000, balance: 50, inventory: { Sunflower: 100000 } },
      // Bắt được 86.000 Sunflower giá 43 FLOWER
      captured: [{ side: 'buy', item: 'Sunflower', qty: 86000, cost: 43 }],
      isTradeable: tradeable,
      refPrice,
      at: 30000
    });
    expect(r.status).toBe('resolved');
    expect(r.adjustments).toEqual([{ item: 'Sunflower', side: 'buy', qty: 14000, sfl: 7, at: 30000 }]);
  });

  it('chia tiền thiếu cho hai món theo giá tham chiếu, tổng tiền giữ đúng', () => {
    const r = reconcileGap({
      before: { at: 0, balance: 100, inventory: { Sunflower: 0, Potato: 0 } },
      after: { at: 60000, balance: 90, inventory: { Sunflower: 14000, Potato: 6000 } },
      captured: [],
      isTradeable: tradeable,
      refPrice,
      at: 1
    });
    expect(r.status).toBe('resolved');
    const sun = r.adjustments.find(a => a.item === 'Sunflower');
    const pot = r.adjustments.find(a => a.item === 'Potato');
    expect(sun.qty).toBe(14000);
    expect(pot.qty).toBe(6000);
    expect(sun.sfl + pot.sfl).toBeCloseTo(10);
    expect(sun.sfl).toBeCloseTo(10 * 7 / 9.4);
  });

  it('bán bị sót: kho giảm và số dư tăng', () => {
    const r = reconcileGap({
      before: { at: 0, balance: 10, inventory: { Kale: 500 } },
      after: { at: 60000, balance: 18, inventory: { Kale: 100 } },
      captured: [],
      isTradeable: tradeable,
      refPrice,
      at: 1
    });
    expect(r.status).toBe('resolved');
    expect(r.adjustments).toEqual([{ item: 'Kale', side: 'sell', qty: 400, sfl: 8, at: 1 }]);
  });

  it('kho tăng nhưng số dư không giảm thì không tự bù (có thể do thu hoạch)', () => {
    const r = reconcileGap({
      before: { at: 0, balance: 10, inventory: { Potato: 0 } },
      after: { at: 60000, balance: 10, inventory: { Potato: 300 } },
      captured: [],
      isTradeable: tradeable,
      refPrice,
      at: 1
    });
    expect(r.status).toBe('unresolved');
    expect(r.reason).toBe('balance_mismatch');
  });

  it('tiền lệch quá xa giá thị trường thì không tự bù', () => {
    const r = reconcileGap({
      before: { at: 0, balance: 100, inventory: { Sunflower: 0 } },
      after: { at: 60000, balance: 0, inventory: { Sunflower: 1000 } }, // 100 FLOWER cho 1.000 Sunflower (~0,5 FLOWER)
      captured: [],
      isTradeable: tradeable,
      refPrice,
      at: 1
    });
    expect(r.reason).toBe('price_mismatch');
  });

  it('ưu tiên món đang được gom, bỏ qua món khác thay đổi do thu hoạch', () => {
    const r = reconcileGap({
      before: { at: 0, balance: 100, inventory: { Sunflower: 0, Potato: 0 } },
      after: { at: 60000, balance: 95, inventory: { Sunflower: 10000, Potato: 50 } },
      captured: [],
      isTradeable: tradeable,
      focusItems: ['Sunflower'],
      refPrice,
      at: 1
    });
    expect(r.adjustments).toHaveLength(1);
    expect(r.adjustments[0]).toMatchObject({ item: 'Sunflower', qty: 10000, sfl: 5 });
  });
});

describe('flipScheduler', () => {
  const config = sched.getSchedulerConfig({ FLIP_FAST_MODE: 'true' });
  const now = 1_000_000;

  it('mặc định tắt chế độ gom: luôn 1 phút, kể cả khi có nhiều lệnh hoặc bấm nút', () => {
    const off = sched.getSchedulerConfig({});
    expect(off.fastEnabled).toBe(false);
    const s = sched.createFarmState();
    sched.applyPollResult(s, { newTrades: 50, newestFulfilledAt: now }, now, off);
    expect(s.mode).toBe('normal');
    sched.startManualBurst(s, now, off, 10);
    expect(sched.nextDelay(s, now, off)).toBe(60_000);
  });

  it('mặc định 1 phút, gom hàng thì 10 giây', () => {
    const s = sched.createFarmState();
    expect(sched.nextDelay(s, now, config)).toBe(60000);
    sched.applyPollResult(s, { newTrades: 12, newestFulfilledAt: now - 120000 }, now, config);
    expect(s.mode).toBe('fast');
    expect(sched.nextDelay(s, now, config)).toBe(10000);
  });

  it('lệnh vừa khớp trong 1 phút cũng bật chế độ nhanh', () => {
    const s = sched.createFarmState();
    sched.applyPollResult(s, { newTrades: 1, newestFulfilledAt: now - 5000 }, now, config);
    expect(s.mode).toBe('fast');
  });

  it('tự bật chế độ gom hàng khi có lệnh khớp liên tục, giữ 10 phút kể từ lệnh mới nhất', () => {
    const s = sched.createFarmState();
    sched.applyPollResult(s, { newTrades: 20, newestFulfilledAt: now }, now, config);
    expect(s.auto).toBe(true);
    expect(s.manualUntil).toBe(now + 10 * 60 * 1000);
    for (let i = 1; i <= 5; i++) sched.applyPollResult(s, { newTrades: 0, newestFulfilledAt: now }, now + i * 10000, config);
    expect(sched.nextDelay(s, now + 60000, config)).toBe(10000);
    // lệnh mới ở phút thứ 5 gia hạn thêm 10 phút
    sched.applyPollResult(s, { newTrades: 1, newestFulfilledAt: now + 300000 }, now + 300000, config);
    expect(s.manualUntil).toBe(now + 300000 + 10 * 60 * 1000);
    const later = now + 300000 + 11 * 60 * 1000;
    sched.applyPollResult(s, { newTrades: 0, newestFulfilledAt: null }, later, config);
    expect(s.auto).toBe(false);
    expect(sched.nextDelay(s, later, config)).toBe(60000);
  });

  it('lệnh khớp 90 giây trước lượt lấy (nhịp 60 giây) vẫn được tính là đang gom', () => {
    const s = sched.createFarmState();
    sched.applyPollResult(s, { newTrades: 1, newestFulfilledAt: now - 90000 }, now, config);
    expect(s.mode).toBe('fast');
  });

  it('nút "Đang gom hàng" giữ chế độ nhanh 10 phút rồi tự tắt', () => {
    const s = sched.createFarmState();
    sched.startManualBurst(s, now, config);
    for (let i = 1; i <= 5; i++) sched.applyPollResult(s, { newTrades: 0, newestFulfilledAt: null }, now + i * 10000, config);
    expect(sched.nextDelay(s, now + 60000, config)).toBe(10000);
    const later = now + 11 * 60 * 1000;
    sched.applyPollResult(s, { newTrades: 0, newestFulfilledAt: null }, later, config);
    expect(sched.nextDelay(s, later, config)).toBe(60000);
  });
});
