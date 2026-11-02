/**
 * Theo dõi đề xuất thật (không gọi API game, chỉ đọc/ghi DB):
 * - Ghi lại các món đang báo Mua (top N) mỗi lần chạy; mỗi món chỉ giữ bản đầu tiên trong ngày.
 * - Chấm kết quả bằng giá sàn 15 phút đã lưu: offer có khớp không, bán được ở giá mục tiêu không, lãi bao nhiêu.
 * - Ghép với lệnh mua thật của chủ app trong Sổ Flip (mua đúng món, giá ≤ offer + 2%, trong thời hạn offer).
 * Sau vài tuần có tỉ lệ khớp thật để chỉnh mức +5% của giá offer.
 */
const cron = require('node-cron');
const recoRepo = require('../repositories/recoRepository.cjs');
const marketRepo = require('../repositories/marketRepository.cjs');
const { evaluateReco, summarizeRecos } = require('../domain/recoEval.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDate = ts => new Date(ts).toISOString().slice(0, 10);
let started = false;

const owners = () => require('../services/flipService.cjs').getOwnerFarmIds();

async function logRecommendations(now = Date.now()) {
  const market = require('../services/marketService.cjs');
  const { signals, taxRate, buyMode } = await market.getSignals({ farmId: owners()[0] });
  const rows = signals.filter(s => s.decision === 'buy' && s.buyPrice > 0 && s.sellTarget > 0).map(s => ({
    date: utcDate(now),
    item: s.item,
    createdAt: now,
    rank: s.rank ?? null,
    mode: buyMode,
    taxRate,
    price: s.price,
    buyPrice: s.buyPrice,
    buyBy: s.buyBy || utcDate(now),
    sellTarget: s.sellTarget,
    sellBy: s.sellBy || utcDate(now + 28 * DAY_MS),
    netMargin: s.netMargin
  }));
  return { inserted: await recoRepo.insertIfMissing(rows), rows };
}

async function evaluateAll(now = Date.now()) {
  const { findBuys } = require('../services/flipService.cjs');
  const list = await recoRepo.unresolved();
  const changes = [];
  for (const r of list) {
    const points = await marketRepo.itemSnapshots(r.item, r.createdAt - 30 * 60 * 1000);
    const ev = evaluateReco(r, points, now, r.taxRate ?? 0.1);
    const buyEnd = Date.parse(`${r.buyBy}T00:00:00Z`) + DAY_MS;
    let userBuys = [];
    for (const farmId of owners()) {
      const buys = await findBuys(farmId, r.item, r.createdAt - 30 * 60 * 1000, buyEnd).catch(() => []);
      userBuys = userBuys.concat(buys.filter(b => b.unitPrice <= r.buyPrice * 1.02));
    }
    const before = r.eval?.status ?? null;
    await recoRepo.setEval(r._id, { eval: { ...ev, evaluatedAt: now }, userBuys });
    if (before !== ev.status) changes.push({ reco: r, from: before, to: ev.status, eval: ev });
  }
  return changes;
}

async function getRecoStats(limit = 200) {
  const list = await recoRepo.recent(limit);
  return { summary: summarizeRecos(list), list: list.slice(0, 50).map(({ _id, ...r }) => r) };
}

/** Chạy 1 lượt: ghi đề xuất rồi chấm. Trả về các đề xuất mới và các thay đổi trạng thái (cho bot Telegram) */
async function runOnce() {
  const logged = await logRecommendations();
  const changes = await evaluateAll();
  return { logged, changes };
}

function startRecoTracker(onResult) {
  if (started) return;
  started = true;
  const run = () => runOnce()
    .then(r => onResult && onResult(r))
    .catch(e => console.warn('[Reco] Lỗi theo dõi đề xuất:', e.message));
  // 7 phút sau mỗi lượt chụp chợ (chụp ở phút 0/15/30/45)
  cron.schedule('7,22,37,52 * * * *', run, { timezone: 'UTC' });
  setTimeout(run, 60 * 1000);
  console.log('[Reco] Ghi đề xuất Mua và chấm kết quả thật 15 phút/lần');
}

module.exports = { startRecoTracker, runOnce, logRecommendations, evaluateAll, getRecoStats };
