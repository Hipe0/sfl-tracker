/**
 * Chấm kết quả thật của một đề xuất Mua (hàm thuần): dùng chuỗi giá sàn 15 phút đã lưu sau lúc đề xuất.
 *
 * - Khớp mua: lúc đề xuất mà giá sàn đã ≤ giá offer thì coi như mua thẳng ở giá sàn; sau đó, lần đầu giá sàn
 *   ≤ giá offer trước hết ngày "Offer tới" thì coi như offer khớp ở giá offer. Hết hạn chưa khớp: 'expired'.
 * - Bán: lần đầu giá sàn ≥ giá bán mục tiêu (listing của mình là rẻ nhất, sẽ có người mua) thì bán ở giá mục tiêu;
 *   hết ngày "Bán chậm nhất" chưa chạm thì bán ở giá sàn lúc đó ('timeout').
 * Đây vẫn là ước lượng (không biết độ sâu sổ lệnh), nhưng sát hơn backtest giá đóng cửa ngày.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const endOfDay = date => Date.parse(`${date}T00:00:00Z`) + DAY_MS - 1;

/**
 * @param {{ createdAt:number, buyPrice:number, buyBy:string, sellTarget:number, sellBy:string }} reco
 * @param {Array<{timestamp:number, price:number}>} points  giá sàn, tăng dần theo thời gian
 */
function evaluateReco(reco, points, now, taxRate = 0.1) {
  const pts = points.filter(p => p.price > 0 && p.timestamp >= reco.createdAt - 20 * 60 * 1000).sort((a, b) => a.timestamp - b.timestamp);
  const buyEnd = endOfDay(reco.buyBy);
  const sellEnd = endOfDay(reco.sellBy);
  let fill = null;
  for (const p of pts) {
    if (p.timestamp > buyEnd) break;
    if (p.price <= reco.buyPrice) {
      const atCreate = p.timestamp <= reco.createdAt + 20 * 60 * 1000;
      fill = { at: p.timestamp, price: atCreate ? p.price : reco.buyPrice };
      break;
    }
  }
  if (!fill) return { status: now > buyEnd ? 'expired' : 'pending' };
  let exit = null;
  let last = null;
  for (const p of pts) {
    if (p.timestamp <= fill.at) continue;
    if (p.timestamp > sellEnd) break;
    last = p;
    if (p.price >= reco.sellTarget) {
      exit = { at: p.timestamp, price: reco.sellTarget, reason: 'target' };
      break;
    }
  }
  if (!exit && now > sellEnd && last) exit = { at: last.timestamp, price: last.price, reason: 'timeout' };
  const base = { fillAt: fill.at, fillPrice: fill.price };
  if (!exit) {
    const mark = last?.price ?? null;
    return { status: 'holding', ...base, markPrice: mark, markRet: mark ? mark * (1 - taxRate) / fill.price - 1 : null };
  }
  return { status: 'done', ...base, exitAt: exit.at, exitPrice: exit.price, reason: exit.reason, ret: exit.price * (1 - taxRate) / fill.price - 1 };
}

/** Thống kê các đề xuất đã chấm */
function summarizeRecos(recos) {
  const decided = recos.filter(r => ['expired', 'holding', 'done'].includes(r.eval?.status));
  const filled = decided.filter(r => r.eval.status !== 'expired');
  const done = recos.filter(r => r.eval?.status === 'done');
  const avg = l => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
  return {
    total: recos.length,
    pending: recos.filter(r => !r.eval || r.eval.status === 'pending').length,
    fillRate: decided.length ? filled.length / decided.length : null,
    holding: recos.filter(r => r.eval?.status === 'holding').length,
    done: done.length,
    winRate: done.length ? done.filter(r => r.eval.ret > 0).length / done.length : null,
    avgReturn: avg(done.map(r => r.eval.ret)),
    userBought: recos.filter(r => r.userBuys?.length).length
  };
}

module.exports = { evaluateReco, summarizeRecos };
