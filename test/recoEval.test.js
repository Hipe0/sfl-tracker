import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { evaluateReco, summarizeRecos } = require('../src-backend/domain/recoEval.cjs');

const T0 = Date.UTC(2026, 10, 2, 12);
const M15 = 15 * 60 * 1000;
const series = prices => prices.map((price, i) => ({ timestamp: T0 + i * M15, price }));
const reco = { createdAt: T0, buyPrice: 0.9, buyBy: '2026-11-03', sellTarget: 1.1, sellBy: '2026-11-10' };

describe('chấm đề xuất thật', () => {
  it('chưa chạm giá offer thì đang chờ, quá hạn thì không khớp', () => {
    const pts = series([1, 0.98, 0.95]);
    expect(evaluateReco(reco, pts, T0 + 3 * M15).status).toBe('pending');
    expect(evaluateReco(reco, pts, Date.UTC(2026, 10, 4, 1)).status).toBe('expired');
  });

  it('khớp offer ở giá offer, chạm giá mục tiêu thì bán ở giá mục tiêu', () => {
    const ev = evaluateReco(reco, series([1, 0.95, 0.85, 1.0, 1.12]), T0 + 10 * M15, 0.1);
    expect(ev.status).toBe('done');
    expect(ev.fillPrice).toBe(0.9);
    expect(ev.reason).toBe('target');
    expect(ev.ret).toBeCloseTo(1.1 * 0.9 / 0.9 - 1, 6);
  });

  it('lúc đề xuất giá sàn đã dưới offer thì mua ở giá sàn', () => {
    const ev = evaluateReco(reco, series([0.8, 0.85]), T0 + 2 * M15);
    expect(ev.status).toBe('holding');
    expect(ev.fillPrice).toBe(0.8);
  });

  it('hết hạn bán chưa chạm mục tiêu thì bán ở giá sàn cuối cùng (timeout)', () => {
    const pts = series([0.88, 0.95, 1.0]);
    const ev = evaluateReco(reco, pts, Date.UTC(2026, 10, 11, 1), 0.1);
    expect(ev.status).toBe('done');
    expect(ev.reason).toBe('timeout');
    expect(ev.exitPrice).toBe(1.0);
  });

  it('thống kê tỉ lệ khớp chỉ tính các đề xuất đã rõ kết quả', () => {
    const s = summarizeRecos([
      { eval: { status: 'expired' } },
      { eval: { status: 'done', ret: 0.2 } },
      { eval: { status: 'done', ret: -0.1 } },
      { eval: { status: 'pending' } },
      { userBuys: [{ qty: 1 }], eval: { status: 'holding' } }
    ]);
    expect(s.fillRate).toBeCloseTo(3 / 4);
    expect(s.winRate).toBe(0.5);
    expect(s.userBought).toBe(1);
  });
});
