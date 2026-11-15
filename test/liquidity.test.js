import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { dailyQuantity, sellCapacity, buySize, unloadPlan } = require('../src-backend/domain/liquidity.cjs');

const DAY = 86400000;
const now = Date.parse('2026-11-15T12:00:00Z');
const day = k => new Date(now - k * DAY).toISOString().slice(0, 10);

describe('liquidity', () => {
  it('lượng khớp ngày = trung vị 14 ngày, bỏ ngày thiếu số', () => {
    const daily = [100, null, 300, 200, 5000].map((quantity, i) => ({ date: day(5 - i), quantity }));
    expect(dailyQuantity(daily, now)).toBe(300);
    expect(dailyQuantity(daily.slice(0, 2), now)).toBeNull();
  });
  it('mỗi ngày bán được = nhỏ hơn giữa 20% lượng khớp và 20 đơn đầy', () => {
    expect(sellCapacity({ dailyQty: 1900000, tradeLimit: 4000 })).toMatchObject({ perDay: 80000, limitedBy: 'listings' });
    expect(sellCapacity({ dailyQty: 75000, tradeLimit: 1000 })).toMatchObject({ perDay: 15000, limitedBy: 'market' });
    expect(sellCapacity({ dailyQty: null, tradeLimit: null })).toBeNull();
  });
  it('khối lượng mua bị chặn bởi thanh khoản hoặc vốn', () => {
    const capacity = sellCapacity({ dailyQty: 75000, tradeLimit: 1000 });
    expect(buySize({ price: 0.005, capacity, budget: 1000 })).toMatchObject({ qty: 75000, limitedBy: 'market' });
    expect(buySize({ price: 0.005, capacity, budget: 100 })).toMatchObject({ qty: 20000, limitedBy: 'budget' });
    expect(buySize({ price: 0.005, capacity })).toMatchObject({ qty: 75000, maxByBudget: null });
  });
  it('kế hoạch xả: tính lùi từ hạn bán, không kịp thì bắt đầu hôm nay', () => {
    const capacity = { perDay: 80000, limitedBy: 'listings' };
    expect(unloadPlan({ qty: 368000, capacity, deadline: day(-10), today: day(0) })).toEqual({ perDay: 80000, days: 5, startBy: day(-6), late: false, limitedBy: 'listings' });
    expect(unloadPlan({ qty: 368000, capacity, deadline: day(-2), today: day(0) })).toMatchObject({ days: 5, startBy: day(0), late: true });
    expect(unloadPlan({ qty: 368000, capacity, deadline: null, today: day(0) })).toMatchObject({ days: 5, startBy: day(0), late: false });
    expect(unloadPlan({ qty: 50000, capacity, deadline: day(-2), today: day(0) })).toBeNull();
  });
});
