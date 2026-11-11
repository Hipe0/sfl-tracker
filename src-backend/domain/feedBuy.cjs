/**
 * Mua trữ cho vật nuôi (hàm thuần, không gọi DB hay API).
 *
 * Món mua để dùng (cho animal ăn) không bị thuế bán, nên không cần chênh lệch đủ lớn như flip: chỉ cần mua
 * vào khúc rẻ nhất của vòng mùa 4 tuần, đủ dùng tới khúc rẻ lần sau. Khúc rẻ lấy theo hồ sơ vòng mùa của
 * CHÍNH món đó (seasonCycle), không phải cứ mùa xuân: số liệu 2025-12 → 2026-11 cho thấy
 * - Corn rẻ nhất giữa mùa xuân (−11% so với mặt bằng), đắt nhất mùa đông
 * - Wheat rẻ nhất cuối mùa hè – mùa thu (−7%), mùa xuân lại đắt nhất (+17%)
 * - Barley rẻ nhất mùa thu (−8%), đắt nhất mùa hè
 *
 * Luật: báo Mua trữ khi hôm nay nằm trong khúc rẻ (các ngày có độ lệch hồ sơ cách đáy ≤ windowTol)
 * hoặc giá đã ≤ giá đáy dự kiến × (1 + priceTol). Còn lại là Chờ, kèm ngày bắt đầu khúc rẻ sau và giá dự kiến.
 * Backtest 8 vòng mùa (2026-03 → 2026-10, walk-forward, mua hết nhu cầu của vòng vào các ngày báo Mua so với
 * mua đều mỗi ngày): Corn rẻ hơn 9.4%, Wheat 9.8%, Barley 7.6%, cả 3 món đều rẻ hơn ở 8/8 vòng.
 * Mua cố định vào mùa xuân: Corn rẻ hơn 5.5% (5/8 vòng), Wheat ĐẮT hơn 14.3% (0/8), Barley đắt hơn 1.4%.
 */
const { prepare, profileAt, slotOf, SLOTS } = require('./seasonCycle.cjs');
const { seasonAt, SEASONS, DAY_MS } = require('./seasons.cjs');

const DEFAULT_FEED_ITEMS = ['Corn', 'Wheat', 'Barley'];
const DEFAULTS = {
  windowTol: 0.02,   // khúc rẻ = các ngày của vòng mùa có giá dự kiến cách ngày rẻ nhất ≤ 2% (backtest: 2% tốt hơn 3–5%)
  priceTol: 0.02,    // ngoài khúc rẻ mà giá đã ≤ giá đáy dự kiến + 2% thì cũng mua
  warmupDays: 84     // backtest: bỏ 3 vòng đầu (hồ sơ cần ≥ 2 vòng mỗi ô)
};

const tsOf = date => Date.parse(`${date}T12:00:00Z`);
const median = list => {
  const v = list.slice().sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
const cycleIndexOf = ts => Math.floor(seasonAt(ts).weekIndex / 4);

/** Mặt bằng (log) đã bỏ yếu tố mùa: trung vị 7 ngày gần nhất, giống seasonCycle.planAt */
function levelAt(prep, t, pr) {
  const levels = [];
  for (let j = Math.max(0, t - 6); j <= t; j++) levels.push(Math.log(prep.rows[j].close) - pr[prep.slots[j]]);
  return median(levels);
}

/** Các ô của khúc rẻ */
function cheapSlots(pr, tol) {
  const minP = Math.min(...pr);
  const set = new Set();
  pr.forEach((v, k) => { if (v <= minP + tol) set.add(k); });
  return { minP, set };
}

/** Quyết định tại ngày chỉ số t (dùng chung cho tín hiệu hiện tại và backtest). price: giá hiện tại (mặc định giá đóng ngày t) */
function planAt(prep, t, ts, { price, ...options } = {}) {
  const opt = { ...DEFAULTS, ...options };
  const pr = profileAt(prep, t);
  if (!pr) return null;
  const s0 = slotOf(ts);
  const level = levelAt(prep, t, pr);
  const { minP, set } = cheapSlots(pr, opt.windowTol);
  const now = price > 0 ? price : prep.rows[t].close;
  const cheapPrice = Math.exp(level + minP);
  const inWindow = set.has(s0);
  const decision = inWindow || now <= cheapPrice * (1 + opt.priceTol) ? 'buy' : 'wait';
  // Khúc rẻ hiện tại còn mấy ngày (tính cả hôm nay) / khúc rẻ sau bắt đầu sau mấy ngày
  let windowLeftDays = null;
  if (inWindow) {
    windowLeftDays = 1;
    while (windowLeftDays < SLOTS && set.has((s0 + windowLeftDays) % SLOTS)) windowLeftDays++;
  }
  let nextInDays = inWindow ? windowLeftDays : 1;
  while (nextInDays < SLOTS && !set.has((s0 + nextInDays) % SLOTS)) nextInDays++;
  const nextPrice = Math.exp(level + pr[(s0 + nextInDays) % SLOTS]);
  // Khúc rẻ sau dài mấy ngày (vd Corn: T5 → CN tuần mùa xuân và T2–T3 đầu mùa hè = 6 ngày)
  let nextWindowDays = 0;
  while (nextWindowDays < SLOTS && set.has((s0 + nextInDays + nextWindowDays) % SLOTS)) nextWindowDays++;
  // Đỉnh của vòng (tham khảo khi dư hàng muốn bán): chặn ở giá cao nhất 90 ngày như seasonCycle
  let hi90 = 0;
  for (let j = Math.max(0, t - 89); j <= t; j++) hi90 = Math.max(hi90, prep.rows[j].close);
  // Hàng dư mua ở khúc rẻ (hôm nay nếu đang trong khúc rẻ, không thì khúc rẻ sau) bán ở đỉnh trong 4 tuần sau đó
  const from = inWindow ? 0 : nextInDays;
  let peakInDays = from + 1;
  for (let k = from + 2; k <= from + SLOTS; k++) if (pr[(s0 + k) % SLOTS] > pr[(s0 + peakInDays) % SLOTS]) peakInDays = k;
  const peakPrice = Math.min(Math.exp(level + pr[(s0 + peakInDays) % SLOTS]), hi90 || Infinity);
  const cheapSeason = SEASONS[Math.floor(pr.indexOf(minP) / 7)];
  // Khúc rẻ (đang ở trong hoặc sắp tới) trải qua những mùa nào, vd Wheat: cuối mùa hè → mùa thu
  let start = inWindow ? s0 : (s0 + nextInDays) % SLOTS;
  if (inWindow) while (set.has((start + SLOTS - 1) % SLOTS) && (start + SLOTS - 1) % SLOTS !== s0) start = (start + SLOTS - 1) % SLOTS;
  const daysBySeason = new Map();
  for (let k = 0; k < SLOTS && set.has((start + k) % SLOTS); k++) {
    const season = SEASONS[Math.floor(((start + k) % SLOTS) / 7)];
    daysBySeason.set(season, (daysBySeason.get(season) || 0) + 1);
  }
  // Mùa chỉ dính 1 ngày của khúc rẻ thì không ghi cho gọn
  const windowSeasons = [...daysBySeason].filter(([, n], i, all) => n >= 2 || all.length === 1).map(([season]) => season);
  return {
    decision,
    price: now,
    level: Math.exp(level),
    slot: s0,
    season: SEASONS[Math.floor(s0 / 7)],
    profile: pr.map(v => Math.exp(v) - 1),
    cheapSeason,
    windowSeasons,
    cheapPrice,
    discount: 1 - cheapPrice / Math.exp(level),
    inWindow,
    windowLeftDays,
    nextInDays,
    nextWindowDays,
    nextPrice,
    cheaperPct: 1 - nextPrice / now,
    peakInDays,
    peakPrice
  };
}

/**
 * Backtest walk-forward: mỗi vòng mùa đủ ngày, mua toàn bộ nhu cầu (1 đơn vị/ngày) vào các ngày luật báo Mua,
 * so với mua đều mỗi ngày. Vòng nào luật không báo ngày nào thì coi như mua đều (tiết kiệm 0).
 */
function backtestFeed(daily, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const prep = prepare(daily);
  const byCycle = {};
  for (let t = opt.warmupDays; t < prep.rows.length; t++) {
    const ts = tsOf(prep.rows[t].date);
    const plan = planAt(prep, t, ts, opt);
    if (!plan) continue;
    const c = (byCycle[cycleIndexOf(ts)] ||= { all: [], buy: [] });
    c.all.push(prep.rows[t].close);
    if (plan.decision === 'buy') c.buy.push(prep.rows[t].close);
  }
  const cycles = Object.values(byCycle).filter(c => c.all.length >= SLOTS - 2);
  const savings = cycles.map(c => 1 - (c.buy.length ? mean(c.buy) : mean(c.all)) / mean(c.all));
  return {
    cycles: cycles.length,
    avgSaving: savings.length ? mean(savings) : null,
    winCycles: savings.filter(s => s > 0).length,
    worst: savings.length ? Math.min(...savings) : null,
    buyDaysPerCycle: cycles.length ? mean(cycles.map(c => c.buy.length)) : null
  };
}

const vnDate = ts => new Date(ts).toISOString().slice(5, 10).split('-').reverse().join('/');
const SEASON_VN = { spring: 'mùa xuân', summer: 'mùa hè', autumn: 'mùa thu', winter: 'mùa đông' };
const seasonsText = list => list.map(s => SEASON_VN[s]).join(' → ');
const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Tín hiệu mua trữ hiện tại của 1 món. daily: [{date, close}] tăng dần; price: giá sàn hiện tại */
function feedSignal(daily, { now = Date.now(), price, taxRate = 0.1, ...options } = {}) {
  const upTo = (daily || []).filter(d => d.close > 0 && tsOf(d.date) <= now + DAY_MS);
  const prep = prepare(upTo);
  const t = prep.rows.length - 1;
  const plan = t >= 0 ? planAt(prep, t, now, { price, ...options }) : null;
  if (!plan) {
    return { decision: 'unknown', price: price ?? upTo[upTo.length - 1]?.close ?? null, reason: 'Chưa đủ 2 vòng mùa dữ liệu để biết lúc nào rẻ' };
  }
  const p = n => n.toPrecision(4);
  // Ngày theo giờ UTC (mùa đổi lúc 0h UTC thứ 2), kèm thứ trong tuần
  const dayLabel = d => `${WEEKDAY[new Date(now + d * DAY_MS).getUTCDay()]} ${vnDate(now + d * DAY_MS)}`;
  const nextEnd = plan.nextInDays + Math.max(1, plan.nextWindowDays) - 1;
  const nextRange = `${dayLabel(plan.nextInDays)} → ${dayLabel(nextEnd)}`;
  let reason;
  if (plan.decision === 'buy') {
    reason = (plan.inWindow
      ? `Đang trong khúc rẻ tới ${dayLabel(plan.windowLeftDays - 1)} (${seasonsText(plan.windowSeasons)}, giá dự kiến ~${p(plan.cheapPrice)}).`
      : `Giá ${p(plan.price)} đã xuống mức đáy dự kiến ~${p(plan.cheapPrice)}.`)
      + ` Khúc rẻ sau: ${nextRange}`;
  } else {
    reason = `Chờ khúc rẻ ${nextRange} (${seasonsText(plan.windowSeasons)}), giá dự kiến ~${p(plan.nextPrice)}`
      + (plan.cheaperPct > 0 ? `, rẻ hơn bây giờ ${(plan.cheaperPct * 100).toFixed(0)}%` : '')
      + '. Hết hàng cho ăn thì chỉ mua đủ dùng tới lúc đó';
  }
  const surplusNet = plan.peakPrice * (1 - taxRate) / plan.cheapPrice - 1;
  return {
    ...plan,
    nextDate: new Date(now + plan.nextInDays * DAY_MS).toISOString().slice(0, 10),
    nextEndDate: new Date(now + nextEnd * DAY_MS).toISOString().slice(0, 10),
    windowEndDate: plan.inWindow ? new Date(now + (plan.windowLeftDays - 1) * DAY_MS).toISOString().slice(0, 10) : null,
    peakDate: new Date(now + plan.peakInDays * DAY_MS).toISOString().slice(0, 10),
    surplusNet,
    cycleIndex: cycleIndexOf(now),
    reason
  };
}

module.exports = { DEFAULT_FEED_ITEMS, DEFAULTS, planAt, feedSignal, backtestFeed };
