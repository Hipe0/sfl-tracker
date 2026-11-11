import { describe, it, expect } from 'vitest';
import { planView } from '../src/flip/lib/plan.js';

describe('planView (giá hiện trên bảng/biểu đồ theo đúng quyết định)', () => {
  const base = { price: 0.0194, buyPrice: 0.0194, sellTarget: 0.0196, netMargin: -0.09, buyBy: null };

  it('Bán ở chế độ mua giá sàn: không có vạch Mua, giá bán = đỉnh gần nhất (không thấp hơn giá hiện tại), không có lãi ròng', () => {
    const p = planView({ ...base, decision: 'sell', cycle: { holdPeakPrice: 0.01962 } });
    expect(p.buy).toBeNull();
    expect(p.sell).toBe(0.01962);
    expect(p.net).toBeNull();
    expect(planView({ ...base, decision: 'sell', cycle: { holdPeakPrice: 0.018 } }).sell).toBe(0.0194);
  });

  it('Bán có kế hoạch mua lại ở đáy: hiện offer mua lại', () => {
    const p = planView({ ...base, decision: 'sell', buyPrice: 0.0149, buyBy: '2026-11-22', cycle: { holdPeakPrice: 0.0196 } });
    expect(p.buy).toBe(0.0149);
    expect(p.buyLabel).toBe('Mua lại');
  });

  it('Mua: giữ nguyên giá mua, giá bán, lãi ròng', () => {
    const p = planView({ ...base, decision: 'buy', netMargin: 0.2, sellTarget: 0.026 });
    expect(p).toMatchObject({ buy: 0.0194, buyLabel: 'Mua', sell: 0.026, net: 0.2 });
  });

  it('Chờ: chỉ có giá khi là offer đặt sẵn thấp hơn giá hiện tại', () => {
    expect(planView({ ...base, decision: 'wait', buyBy: '2026-11-12' }).buy).toBeNull();
    expect(planView({ ...base, decision: 'wait', buyPrice: 0.015, buyBy: '2026-11-22' })).toMatchObject({ buy: 0.015, buyLabel: 'Offer' });
  });

  it('Không / chưa rõ: không có giá', () => {
    expect(planView({ ...base, decision: 'avoid' })).toEqual({ buy: null, sell: null, net: null });
    expect(planView(null).buy).toBeNull();
  });
});
