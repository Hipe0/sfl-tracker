/**
 * Tầng nghiệp vụ cho trang Thị trường & Điểm mua. CHỈ ĐỌC DB (repositories), không gọi API.
 */
const repo = require('../repositories/marketRepository.cjs');
const demandRepo = require('../repositories/demandRepository.cjs');
const farmStateRepo = require('../repositories/farmStateRepository.cjs');
const seasons = require('../domain/seasons.cjs');
const { CHAPTERS } = require('../domain/chapters.cjs');
const { CATEGORIES, categoryOf } = require('../domain/items.cjs');
const { scoreItem } = require('../domain/buySignal.cjs');
const { backtestItem } = require('../domain/backtest.cjs');
const { cyclePlan, simulatePortfolio, cycleRecord, runUpOf } = require('../domain/seasonCycle.cjs');
const faction = require('../domain/factionRotation.cjs');
const stockPeaks = require('../domain/stockPeaks.cjs');
const feedBuy = require('../domain/feedBuy.cjs');
const { stockSignal } = stockPeaks;
const { candlesFromSnapshots, candlesFromDaily, withDailyDiffs, utcDay } = require('../domain/candles.cjs');
const { getTaxModule } = require('../utils/sharedModules.cjs');

const DAY_MS = seasons.DAY_MS;
const RANGES = { '1D': 1, '3D': 3, '7D': 7, '30D': 30, '90D': 90 };
const CACHE_MS = 60 * 1000;
const cache = new Map();
const utcDate = ts => new Date(ts).toISOString().slice(0, 10);

function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = fn();
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => cache.delete(key));
  return promise;
}

function clearCache() {
  cache.clear();
}

const groupBy = (rows, key) => rows.reduce((m, r) => {
  (m[r[key]] ||= []).push(r);
  return m;
}, {});

/** Dữ liệu ngày theo từng tài nguyên, đã đổi số luỹ kế thành số trong ngày */
const dailyByItem = rows => Object.fromEntries(Object.entries(groupBy(rows, 'item')).map(([item, list]) => [item, withDailyDiffs(list)]));

/** Thuế bán tài nguyên của farm (đọc gameData đã lưu trong DB) */
async function taxRateForFarm(farmId) {
  const { calculateTradeTax } = await getTaxModule();
  const state = farmId ? await farmStateRepo.get(farmId) : null;
  if (!state?.gameData) return { taxRate: 0.1, fromFarm: false };
  return { taxRate: calculateTradeTax('Wood', state.gameData), fromFarm: true };
}

/** Lịch mùa, chapter, nguyên liệu Lava Pit */
function getCalendar(now = Date.now()) {
  const upcoming = seasons.upcomingSeasons(now, 4).map(s => ({
    ...s,
    label: seasons.SEASON_LABELS[s.season],
    crops: seasons.SEASONAL_CROPS[s.season],
    lavaPit: seasons.LAVA_PIT_REQUIREMENTS[s.season]
  }));
  return {
    now,
    current: upcoming[0],
    upcoming,
    chapter: seasons.chapterAt(now, CHAPTERS),
    categories: CATEGORIES.map(({ id, label }) => ({ id, label }))
  };
}

/** Nhu cầu Lava Pit của 4 mùa tới tính từ thời điểm now (hàm thuần, dùng cả cho backtest) */
function lavaPitDemand(now) {
  const byItem = {};
  for (const s of seasons.upcomingSeasons(now, 4)) {
    for (const [item, qty] of Object.entries(seasons.LAVA_PIT_REQUIREMENTS[s.season])) {
      (byItem[item] ||= []).push({ season: s.season, qty, source: 'lava_pit', label: 'Lava Pit' });
    }
  }
  return byItem;
}

/** Nhu cầu các mùa sắp tới theo từng tài nguyên: Lava Pit (tự động) + bản ghi nhu cầu có bật useInScore */
async function upcomingDemand(now = Date.now()) {
  const byItem = lavaPitDemand(now);
  const next = seasons.upcomingSeasons(now, 4);
  const chapter = seasons.chapterAt(now, CHAPTERS);
  const extra = await demandRepo.list({ useInScore: true }).catch(() => []);
  for (const d of extra) {
    if (d.season && !next.some(s => s.season === d.season)) continue;
    if (d.chapterWeek && chapter.week && d.chapterWeek !== chapter.week && d.chapterWeek !== chapter.week + 1) continue;
    for (const [item, qty] of Object.entries(d.items || {})) {
      (byItem[item] ||= []).push({ season: d.season || next[0].season, qty, source: d.source, label: d.note || d.source });
    }
  }
  return byItem;
}

/**
 * Tổng quan thị trường trong khoảng range: giá hiện tại, % đổi giá, volume, supply/holders
 */
async function getOverview(range = '7D') {
  const days = RANGES[range] || 7;
  return cached(`overview|${days}`, async () => {
    const now = Date.now();
    const fromDate = utcDate(now - (days * 2 + 1) * DAY_MS);
    const startDate = utcDate(now - days * DAY_MS);
    const [snap, daily, supply] = await Promise.all([
      repo.latestSnapshot(),
      repo.allDaily(fromDate),
      repo.allSupply(utcDate(now - (days + 8) * DAY_MS))
    ]);
    const dailyBy = dailyByItem(daily);
    const supplyBy = groupBy(supply, 'item');
    const names = new Set([...Object.keys(snap?.prices || {}), ...Object.keys(dailyBy)]);
    const items = [];
    let volume = 0;
    let prevVolume = 0;
    let trades = 0;
    for (const item of names) {
      const rows = dailyBy[item] || [];
      const inRange = rows.filter(r => r.date > startDate);
      const before = rows.filter(r => r.date <= startDate);
      const startClose = before.length ? before[before.length - 1].close : rows[0]?.close ?? null;
      const price = snap?.prices?.[item] ?? rows[rows.length - 1]?.close ?? null;
      const vol = inRange.reduce((a, r) => a + (r.volume || 0), 0);
      const prevVol = before.slice(-days).reduce((a, r) => a + (r.volume || 0), 0);
      const tr = inRange.reduce((a, r) => a + (r.trades || 0), 0);
      volume += vol;
      prevVolume += prevVol;
      trades += tr;
      const sup = supplyBy[item] || [];
      const supLast = sup[sup.length - 1] || null;
      const supStart = sup.filter(s => s.date <= startDate).pop() || sup[0] || null;
      items.push({
        item,
        category: categoryOf(item),
        seasons: seasons.seasonsForItem(item),
        price,
        bestOffer: snap?.bestOffers?.[item] ?? null,
        listings: snap?.listings?.[item] ?? null,
        priceChange: price > 0 && startClose > 0 ? price / startClose - 1 : null,
        volume: vol,
        trades: tr,
        supply: supLast?.supply ?? null,
        holders: supLast?.holders ?? null,
        supplyChange: supLast && supStart && supStart !== supLast && supStart.supply > 0 ? supLast.supply / supStart.supply - 1 : null
      });
    }
    items.sort((a, b) => b.volume - a.volume);
    return {
      range,
      updatedAt: snap?.timestamp ?? null,
      flowerPrice: snap?.flowerPrice ?? null,
      totals: { volume, trades, volumeChange: prevVolume > 0 ? volume / prevVolume - 1 : null, items: items.length },
      coverage: {
        dailyDays: new Set(daily.map(r => r.date)).size,
        supplyDays: new Set(supply.map(r => r.date)).size
      },
      items
    };
  });
}

const HISTORY_DAYS = 330;
const BACKTEST_CACHE_MS = 60 * 60 * 1000;

/**
 * Backtest luật phân vị cũ trên toàn bộ lịch sử, từng tài nguyên (chỉ để tham khảo ở trang chi tiết).
 * Nặng (~15 giây CPU) nên chạy nền, chia nhỏ theo từng món để không chặn server, lưu 1 giờ.
 * Chưa có kết quả thì trả về {} ngay (trang vẫn hiện, phần backtest cũ trống vài chục giây đầu).
 * Trả về { [item]: { current, noTrend } }: luật hiện tại và luật cũ (không lọc xu hướng) để so sánh.
 */
let backtestJob = null;
let backtestLast = null;

async function computeBacktests(dailyBy, taxRate) {
  const demandAt = item => now => lavaPitDemand(now)[item] || [];
  const result = {};
  for (const [item, daily] of Object.entries(dailyBy)) {
    const run = options => {
      const r = backtestItem({ item, daily, taxRate, demandAt: demandAt(item), options });
      return { ...r, list: r.list.slice(-20) };
    };
    result[item] = { current: run({}), noTrend: run({ trendFilter: false }) };
    await new Promise(resolve => setImmediate(resolve));
  }
  return result;
}

function getBacktests(dailyBy, taxRate) {
  const key = `${taxRate}|${Object.values(dailyBy).reduce((a, r) => a + r.length, 0)}`;
  const fresh = backtestLast && backtestLast.key === key && Date.now() - backtestLast.at < BACKTEST_CACHE_MS;
  if (!fresh && !backtestJob) {
    backtestJob = computeBacktests(dailyBy, taxRate)
      .then(result => { backtestLast = { key, at: Date.now(), result }; })
      .catch(e => console.warn('[Market] Lỗi backtest:', e.message))
      .finally(() => { backtestJob = null; });
  }
  return backtestLast?.key === key ? backtestLast.result : (backtestLast?.result || {});
}

// 'trough' = canh đáy, đặt offer ở giá đáy dự kiến (mặc định); 'now' = mua ngay ở giá sàn
// Giữ hàng tối đa bao nhiêu ngày tính từ lúc mở phiên (giống maxHoldDays của backtest vòng mùa)
const MAX_HOLD_DAYS = Number(process.env.MARKET_MAX_HOLD_DAYS) || 28;
const BUY_MODE = process.env.MARKET_BUY_MODE === 'now' ? 'now' : 'trough';
/**
 * Chỉ báo Mua cho N món tốt nhất cùng lúc (tập trung vốn vào ít lệnh). Đặt MARKET_TOP_N để đổi.
 * Backtest 2026-11-06 (thuế 10%, lãi trên tổng vốn): 'now' top1 294%, top2 303%, top3 266%, top5 233%, top8 150%;
 * 'trough' chỉ tốt ở top3 (218%; top2 129%, top4 150%). Nên mặc định: now → 2, trough → 3.
 */
const TOP_N = Math.max(1, Number(process.env.MARKET_TOP_N) || (BUY_MODE === 'now' ? 2 : 3));
const portfolioCache = new Map();

/** Backtest danh mục theo vòng mùa (top N, giữ ≤ 28 ngày), lưu 1 giờ */
function getPortfolioBacktest(dailyBy, taxRate) {
  const key = `${taxRate}|${TOP_N}|${BUY_MODE}|${Object.values(dailyBy).reduce((a, r) => a + r.length, 0)}`;
  const hit = portfolioCache.get(key);
  if (hit && Date.now() - hit.at < BACKTEST_CACHE_MS) return hit.result;
  const result = simulatePortfolio(dailyBy, { taxRate, topN: TOP_N, mode: BUY_MODE });
  portfolioCache.clear();
  portfolioCache.set(key, { at: Date.now(), result });
  return result;
}

/**
 * Thành tích theo vòng mùa của từng món (seasonCycle.cycleRecord: mua ô đáy, bán ô đỉnh, walk-forward).
 * Dùng để lọc danh sách theo dõi: món giá đi đều hoặc mua đáy bán đỉnh vẫn lỗ thì ẩn khỏi bảng.
 * Tính từng món (nhường event loop giữa các món), lưu 1 giờ. Lỗi thì trả null (hiện tất cả).
 */
// Theo khoá (thuế | số dòng dữ liệu): thuế mỗi farm khác nhau nên không dùng kết quả của thuế khác
const recordCache = new Map(); // key -> { at, result, job }
// Backtest 2026-11-06: giữ ~13 món (Potato, Turnip, Pepper, Pumpkin, Eggplant, Onion, Barley, Blueberry, Rhubarb, Zucchini, Radish, Merino Wool, Wheat)
const WATCH_RULE = { minTrades: 4, minWinRate: 0.5, minAvgReturn: 0.1 };

async function getItemRecords(dailyBy, taxRate) {
  const rows = Object.values(dailyBy).reduce((a, r) => a + r.length, 0);
  const key = `${taxRate}|${rows}`;
  const hit = recordCache.get(key);
  if (hit?.result && Date.now() - hit.at < BACKTEST_CACHE_MS) return hit.result;
  if (hit?.job) return hit.result || hit.job;
  // Bỏ khoá cũ của cùng mức thuế (dữ liệu đã thêm dòng) để Map không phình
  for (const k of recordCache.keys()) if (k !== key && k.startsWith(`${taxRate}|`)) recordCache.delete(k);
  const entry = { at: 0, result: hit?.result || null, job: null };
  entry.job = (async () => {
    const result = {};
    for (const [item, daily] of Object.entries(dailyBy)) {
      result[item] = cycleRecord(daily, { taxRate });
      await new Promise(resolve => setImmediate(resolve));
    }
    return result;
  })()
    .then(result => Object.assign(entry, { at: Date.now(), result }).result)
    .catch(e => { console.warn('[Market] Lỗi tính thành tích từng món:', e.message); return null; })
    .finally(() => { entry.job = null; });
  recordCache.set(key, entry);
  // Lần đầu với khoá này thì chờ tính xong (~0,1s CPU, Render vài giây); đã có kết quả cũ cùng khoá thì trả ngay
  return entry.result || entry.job;
}

const isWatched = (s, rec) => !rec
  || s.decision === 'buy'
  || (rec.trades >= WATCH_RULE.minTrades && rec.winRate >= WATCH_RULE.minWinRate && rec.avgReturn >= WATCH_RULE.minAvgReturn);

const vnDay = ts => new Date(ts).toISOString().slice(5, 10).split('-').reverse().join('/');
const factionText = list => list.map(r => `${faction.FACTION_LABELS[r.faction]} ${r.qty}`).join(', ');

/**
 * Yêu cầu Kitchen của faction (xoay vòng 12 tuần): ghi lý do cho món được xin tuần này / tuần sau, và
 * báo Mua món sắp được xin tuần sau nếu lịch sử "mua cuối tuần trước, bán cuối tuần được xin" của chính món đó
 * đủ tốt (≥ 6 lần, lãi ròng TB ≥ 5%, thắng ≥ 55%). Không đè lên Bán/Không của vòng mùa.
 */
function applyFaction(signals, dailyBy, now, taxRate) {
  const thisMonday = faction.mondayOf(now);
  const nextMonday = thisMonday + 7 * DAY_MS;
  const thisWeek = faction.requestsAt(now);
  const nextWeek = faction.requestsAt(nextMonday);
  const nextKey = faction.isKeyWeek(nextMonday);
  for (const s of signals) {
    const cur = thisWeek[s.item];
    const next = nextWeek[s.item];
    if (!cur && !next) continue;
    const hist = faction.requestHistory(s.item, dailyBy[s.item] || [], now, taxRate);
    const histText = hist.trades
      ? `lịch sử ${hist.trades} lần mua cuối tuần trước, bán cuối tuần được xin: lãi ròng TB ${(hist.avgNet * 100).toFixed(1)}%, thắng ${(hist.winRate * 100).toFixed(0)}%`
      : 'chưa có lịch sử';
    s.faction = { thisWeek: cur || null, nextWeek: next || null, nextFrom: next ? utcDate(nextMonday) : null, nextKeyWeek: !!next && nextKey, history: { ...hist, last: undefined } };
    if (cur) s.reasons.push(`Faction tuần này (tới CN ${vnDay(nextMonday - DAY_MS)}) đang xin: ${factionText(cur)}`);
    if (!next) continue;
    s.reasons.push(`Faction tuần sau (từ ${vnDay(nextMonday)}${nextKey ? ', tuần thưởng chìa' : ''}) xin: ${factionText(next)}; ${histText}`);
    if (!faction.isGoodHistory(hist) || !(s.price > 0) || ['sell', 'avoid', 'buy'].includes(s.decision)) continue;
    const ru = runUpOf(dailyBy[s.item] || [], s.price, now, 14);
    if (ru.runUp != null && ru.runUp > faction.MAX_RUN_UP) {
      s.reasons.push(`Không mua theo faction: giá đã bay +${(ru.runUp * 100).toFixed(0)}% so với đáy 14 ngày (${ru.low.toPrecision(4)}), chỉ mua khi còn cách đáy ≤ ${faction.MAX_RUN_UP * 100}%`);
      continue;
    }
    // Giá bán = giá hiện tại × (1 + mức tăng TRUNG VỊ các lần được xin), không vượt đỉnh 60 ngày.
    // Trước lấy trung bình nên bị vài tuần tăng vọt kéo lên (Cabbage 2026-11-06: đòi 0.001858, 60 ngày chưa chạm)
    const recent = (dailyBy[s.item] || []).slice(-60).map(d => d.close).filter(c => c > 0);
    const high60 = recent.length ? Math.max(...recent) : Infinity;
    const sellTarget = Math.min(s.price * (1 + hist.medianGross), high60);
    if (sellTarget * (1 - taxRate) / s.price - 1 < faction.MIN_AVG_NET) {
      s.reasons.push(`Không mua theo faction: bán ở mức tăng thường gặp (${sellTarget.toPrecision(4)}, trần đỉnh 60 ngày ${high60.toPrecision(4)}) trừ thuế lãi chưa tới ${faction.MIN_AVG_NET * 100}%`);
      continue;
    }
    Object.assign(s, {
      decision: 'buy',
      buyPrice: s.price,
      sellTarget,
      netMargin: sellTarget * (1 - taxRate) / s.price - 1,
      buyBy: utcDate(nextMonday - DAY_MS),
      sellBy: utcDate(nextMonday + 6 * DAY_MS),
      cycleBuy: { source: 'faction', rank: hist.avgNet * hist.winRate }
    });
    s.reasons.push(`Mua theo faction: mua trước CN ${vnDay(nextMonday - DAY_MS)}, treo bán ${sellTarget.toPrecision(4)} (mức tăng trung vị ${(hist.medianGross * 100).toFixed(0)}% các lần được xin${sellTarget >= high60 ? ', chặn ở đỉnh 60 ngày' : ''}) trong tuần được xin, chậm nhất ${vnDay(nextMonday + 6 * DAY_MS)}`);
  }
  return signals;
}

/** Giữ 'buy' cho TOP_N món có lãi kỳ vọng × độ ổn định cao nhất, còn lại chuyển 'wait' */
function keepTopBuys(signals, topN = TOP_N) {
  const buys = signals.filter(s => s.decision === 'buy').sort((a, b) => (b.cycleBuy?.rank ?? b.score ?? 0) - (a.cycleBuy?.rank ?? a.score ?? 0));
  buys.forEach((s, i) => {
    if (i < topN) {
      s.rank = i + 1;
      return;
    }
    s.decision = 'wait';
    s.reasons = [...s.reasons, `Chờ: ngoài top ${topN} lệnh tốt nhất hôm nay (xếp thứ ${i + 1}), tập trung vốn vào các món trên`];
  });
  return signals;
}

/** Đề xuất mua cho mọi tài nguyên */
async function getSignals({ farmId } = {}) {
  const { taxRate, fromFarm } = await taxRateForFarm(farmId);
  return cached(`signals|${taxRate}`, async () => {
    const now = Date.now();
    const [snap, daily, supply, demand] = await Promise.all([
      repo.latestSnapshot(),
      repo.allDaily(utcDate(now - HISTORY_DAYS * DAY_MS)),
      repo.allSupply(utcDate(now - 95 * DAY_MS)),
      upcomingDemand(now)
    ]);
    const dailyBy = dailyByItem(daily);
    const supplyBy = groupBy(supply, 'item');
    const backtests = getBacktests(dailyBy, taxRate);
    const signals = Object.keys(dailyBy).map(item => ({
      ...scoreItem({
        item,
        daily: dailyBy[item],
        current: { floor: snap?.prices?.[item], bestOffer: snap?.bestOffers?.[item], listingCount: snap?.listings?.[item] },
        supply: supplyBy[item] || [],
        taxRate,
        demand: demand[item] || [],
        backtest: backtests[item]?.current || null,
        cycle: cyclePlan(dailyBy[item], now, { taxRate, mode: BUY_MODE }),
        now
      }),
      backtestNoTrend: backtests[item]?.noTrend ? { ...backtests[item].noTrend, list: undefined } : null,
      backtestTrades: backtests[item]?.current?.list || [],
      category: categoryOf(item),
      seasons: seasons.seasonsForItem(item),
      demand: demand[item] || []
    }));
    applyFaction(signals, dailyBy, now, taxRate);
    keepTopBuys(signals);
    // Danh sách theo dõi: chỉ món có lịch sử vòng mùa tốt + món đang báo Mua. Máy vẫn quét tất cả để chọn top
    const records = await getItemRecords(dailyBy, taxRate);
    for (const s of signals) {
      s.record = records?.[s.item] || null;
      s.watch = isWatched(s, records ? records[s.item] || { trades: 0 } : null);
    }
    const order = { buy: 0, sell: 1, wait: 2, avoid: 3, none: 4 };
    signals.sort((a, b) => order[a.decision] - order[b.decision] || (a.rank ?? 99) - (b.rank ?? 99) || (b.score ?? -1) - (a.score ?? -1));
    const portfolio = getPortfolioBacktest(dailyBy, taxRate);
    return { taxRate, taxFromFarm: fromFarm, updatedAt: snap?.timestamp ?? null, topN: TOP_N, buyMode: BUY_MODE, portfolio, watchRule: records ? WATCH_RULE : null, signals };
  });
}

/**
 * Hàng đang giữ (lô chưa bán trong Sổ Flip) của các farm, ghép với đề xuất vòng mùa:
 * nên bán ngay, treo bán ở giá nào, chậm nhất ngày nào. Chỉ đọc DB.
 */
async function getHoldings(farmIds = []) {
  const { buildFlipReport } = require('./flipService.cjs');
  const [{ signals, taxRate }, reports] = await Promise.all([
    getSignals({ farmId: farmIds[0] }),
    // Chỉ các món đang mở phiên trong Sổ Flip (giống bảng mặc định của tab Sổ Flip), không lấy cả lịch sử
    Promise.all(farmIds.map(id => buildFlipReport(id, { category: 'resource', range: 'session' }).catch(() => null)))
  ]);
  const bySignal = new Map(signals.map(s => [s.item, s]));
  const now = Date.now();
  const today = utcDate(now);
  const dateIn = d => utcDate(now + d * DAY_MS);
  // Ngày bán đã hẹn cho mỗi lô đang giữ (farm|món|lúc mở phiên). Đỉnh vòng mùa tính lại mỗi ngày nên nếu không
  // nhớ thì qua ngày hẹn nó tự lùi sang đỉnh vòng sau và cứ báo "Giữ" mãi
  const plans = (await repo.getMeta('holdPlans').catch(() => ({}))).plans || {};
  const ignored = await getHoldIgnore();
  const marks = (await repo.getMeta('holdListed').catch(() => ({}))).farms || {};
  // Lệnh đang treo bán của chính farm (trades.listings trong trạng thái farm đã lưu DB, cập nhật theo vòng lấy giao dịch)
  const farmListings = await Promise.all(farmIds.map(id => require('../repositories/farmStateRepository.cjs').get(id)
    .then(st => listingsByItem(st?.gameData)).catch(() => ({}))));
  const keptMarks = {};
  const seen = {};
  const rows = [];
  reports.forEach((report, i) => {
    // Giá vốn = giá mua TB của phiên, giống cột "Giá mua TB" ở Sổ Flip (không lấy giá các lô cũ trước phiên)
    const held = (report?.resources || []).map(r => ({
      item: r.item,
      qty: r.openQty,
      cost: r.avgBuyPrice > 0 ? r.avgBuyPrice * r.openQty : r.openCost,
      oldestBuyAt: r.sessionStartedAt
    }));
    for (const h of held) {
      if (!(h.qty > 0)) continue;
      if (ignored[String(farmIds[i])]?.includes(h.item)) continue;
      const sig = bySignal.get(h.item);
      const avgCost = h.cost / h.qty;
      const price = sig?.price ?? null;
      const cycle = sig?.cycle;
      const target = cycle ? Math.max(cycle.holdPeakPrice, price || 0) : sig?.sellTarget ?? null;
      const net = p => (p > 0 && avgCost > 0 ? p * (1 - taxRate) / avgCost - 1 : null);
      const planKey = `${farmIds[i]}|${h.item}|${h.oldestBuyAt || 0}`;
      // Giữ tối đa 1 vòng mùa (28 ngày từ lúc mở phiên), giống luật thoát lệnh trong backtest
      const holdDeadline = h.oldestBuyAt ? utcDate(h.oldestBuyAt + MAX_HOLD_DAYS * DAY_MS) : null;
      const peakDate = plans[planKey] || (cycle ? dateIn(cycle.holdPeakInDays) : null);
      if (peakDate) seen[planKey] = peakDate;
      const planned = holdDeadline && (!peakDate || holdDeadline < peakDate) ? holdDeadline : peakDate;
      const overdue = planned != null && planned < today;
      const tooLong = holdDeadline != null && holdDeadline < today;
      let action;
      let note;
      if (!sig || !price) {
        action = 'unknown';
        note = 'Chưa có giá trên chợ';
      } else if (overdue) {
        action = 'sell_now';
        const n = net(price);
        const pnl = n != null ? ` (${n >= 0 ? 'lãi' : 'lỗ'} ${(Math.abs(n) * 100).toFixed(1)}% sau thuế)` : '';
        note = tooLong
          ? `Đã giữ ${Math.floor((now - h.oldestBuyAt) / DAY_MS)} ngày, quá giới hạn ${MAX_HOLD_DAYS} ngày (1 vòng mùa): bán ở giá thị trường${pnl}, đừng ôm vốn tiếp`
          : `Đã quá ngày bán dự kiến (${planned}) mà chưa khớp: bán ở giá thị trường${pnl}, đừng chờ tiếp`;
      } else if (sig.decision === 'sell' || (cycle && cycle.holdPeakInDays === 0)) {
        action = 'sell_now';
        note = cycle && cycle.dropInDays
          ? `Vòng mùa: ${cycle.dropInDays} ngày tới giá thường giảm ~${(cycle.drop * 100).toFixed(0)}%, nên bán ngay`
          : 'Hôm nay là đỉnh dự kiến của vòng mùa, nên bán';
      } else if (sig.sellTarget && price >= target) {
        action = 'sell_now';
        note = 'Giá đã chạm giá bán mục tiêu';
      } else if (cycle) {
        action = 'hold';
        note = planned === holdDeadline && holdDeadline !== peakDate
          ? `Treo bán ${target.toPrecision(4)}; đỉnh dự kiến ${peakDate} nằm sau hạn giữ tối đa ${MAX_HOLD_DAYS} ngày, nên chậm nhất ${planned} chưa khớp thì bán ở giá thị trường`
          : `Treo bán ${target.toPrecision(4)}, đỉnh dự kiến khoảng ${planned}; quá ngày đó chưa khớp thì bán ở giá thị trường`;
        const nt = net(target);
        if (nt != null && nt < 0) note += `. Lưu ý: bán ở đỉnh vẫn lỗ ~${(-nt * 100).toFixed(1)}% sau thuế, giữ chỉ để lỗ ít hơn; cần vốn thì cắt luôn`;
      } else {
        action = 'hold';
        note = 'Chưa đủ dữ liệu vòng mùa, theo dõi tay';
      }
      const fid = String(farmIds[i]);
      const list = listState({
        ask: action === 'sell_now' ? price : target,
        floor: price,
        listed: farmListings[i][h.item] || null,
        marked: marks[fid]?.[h.item] ?? null
      });
      if (marks[fid]?.[h.item]) (keptMarks[fid] ||= {})[h.item] = marks[fid][h.item];
      rows.push({
        farmId: farmIds[i],
        list,
        item: h.item,
        qty: h.qty,
        avgCost,
        cost: h.cost,
        oldestBuyAt: h.oldestBuyAt,
        heldDays: h.oldestBuyAt ? (now - h.oldestBuyAt) / DAY_MS : null,
        price,
        netNow: net(price),
        target,
        netAtTarget: net(target),
        sellBy: planned,
        overdue,
        decision: sig?.decision ?? 'none',
        action,
        note
      });
    }
  });
  // Lưu ngày hẹn mới, bỏ các lô đã bán hết hoặc đóng phiên
  // Farm nào lỗi đọc sổ thì giữ nguyên ngày hẹn cũ của farm đó
  const failed = farmIds.filter((id, i) => !reports[i]).map(String);
  for (const [k, v] of Object.entries(plans)) if (failed.includes(k.split('|')[0])) seen[k] = v;
  if (JSON.stringify(seen) !== JSON.stringify(plans)) await repo.setMeta('holdPlans', { plans: seen }).catch(() => {});
  const order = { sell_now: 0, hold: 1, unknown: 2 };
  rows.sort((a, b) => order[a.action] - order[b.action] || b.cost - a.cost);
  // Bỏ dấu "đã list" của món không còn giữ (bán hết / đóng phiên)
  if (failed.length === 0 && JSON.stringify(keptMarks) !== JSON.stringify(marks)) await repo.setMeta('holdListed', { farms: keptMarks }).catch(() => {});
  const hidden = farmIds.flatMap(id => (ignored[String(id)] || []).map(item => ({ farmId: String(id), item })));
  return { taxRate, rows, hidden };
}

/**
 * Khoảng giá được phép list tài nguyên trên chợ, theo source game (src/features/marketplace/components/ResourceList.tsx):
 * giá/1 cái phải trong [floor × 0.8, floor × 1.2], so sánh sau khi làm tròn 4 chữ số thập phân
 */
const LIST_MIN_RATIO = 0.8;
const LIST_MAX_RATIO = 1.2;
const round4 = x => Math.round(x * 1e4) / 1e4;

/** { item: { qty, count, unitPrice } } từ trades.listings của farm (resource nằm trong collection "collectibles") */
function listingsByItem(gameData) {
  const out = {};
  for (const l of Object.values(gameData?.trades?.listings || {})) {
    const entries = Object.entries(l?.items || {});
    if (entries.length !== 1 || !(Number(l.sfl) > 0)) continue;
    const [item, qty] = entries[0];
    if (!(Number(qty) > 0)) continue;
    const o = out[item] || (out[item] = { qty: 0, count: 0, unitPrice: Infinity });
    o.qty += Number(qty);
    o.count += 1;
    o.unitPrice = Math.min(o.unitPrice, Number(l.sfl) / Number(qty));
  }
  return out;
}

/**
 * Trạng thái list của 1 món đang giữ:
 * - listed: farm đang có lệnh treo bán món này (đọc từ API) hoặc người dùng tự đánh dấu đã list
 * - can_list: giá muốn treo nằm trong khoảng game cho phép → list ở price
 * - wait: giá muốn treo cao hơn trần (floor × 1.2), chờ giá sàn lên tới needFloor
 */
function listState({ ask, floor, listed, marked }) {
  const min = floor > 0 ? round4(floor * LIST_MIN_RATIO) : null;
  const max = floor > 0 ? round4(floor * LIST_MAX_RATIO) : null;
  const base = { min, max };
  if (listed) return { ...base, state: 'listed', source: 'api', qty: listed.qty, count: listed.count, unitPrice: listed.unitPrice };
  if (marked) return { ...base, state: 'listed', source: 'manual', markedAt: marked };
  if (!(ask > 0) || !(floor > 0)) return { ...base, state: 'unknown' };
  const a = round4(ask);
  if (a > max) return { ...base, state: 'wait', ask, needFloor: ask / LIST_MAX_RATIO };
  // Giá muốn treo thấp hơn sàn dưới (hiếm): game chỉ cho list từ min trở lên
  return { ...base, state: 'can_list', price: a < min ? floor * LIST_MIN_RATIO : ask };
}

async function setHoldListed(farmId, item, listed) {
  const name = typeof item === 'string' ? item.trim() : '';
  if (!farmId || !name) return { errors: ['item'] };
  const farms = (await repo.getMeta('holdListed').catch(() => ({}))).farms || {};
  const f = farms[String(farmId)] || {};
  if (listed) f[name] = Date.now();
  else delete f[name];
  farms[String(farmId)] = f;
  await repo.setMeta('holdListed', { farms });
  return { item: name, listed: Boolean(listed) };
}

/**
 * Món người dùng bỏ khỏi "Hàng đang giữ" (mua để dùng, không bán): { farmId: [item] }.
 * Chỉ ẩn khỏi danh sách này (và tin Telegram /giu), Sổ Flip vẫn tính bình thường
 */
async function getHoldIgnore() {
  return (await repo.getMeta('holdIgnore').catch(() => ({}))).farms || {};
}

async function setHoldIgnore(farmId, item, ignore) {
  const name = typeof item === 'string' ? item.trim() : '';
  if (!farmId || !name) return { errors: ['item'] };
  const farms = await getHoldIgnore();
  const list = new Set(farms[String(farmId)] || []);
  if (ignore) list.add(name);
  else list.delete(name);
  farms[String(farmId)] = [...list].sort();
  await repo.setMeta('holdIgnore', { farms });
  return { item: name, ignored: Boolean(ignore) };
}

/** Lịch sử 1 tài nguyên: nến, supply, dải mùa, đề xuất */
async function getItemHistory(item, { granularity = '1d', range = '30D', farmId } = {}) {
  const days = RANGES[range] || 30;
  const now = Date.now();
  const from = now - days * DAY_MS;
  const [snap, rawDaily, supply, signals, points] = await Promise.all([
    repo.latestSnapshot(),
    repo.itemDaily(item, utcDate(now - 91 * DAY_MS)),
    repo.itemSupply(item, utcDate(from)),
    getSignals({ farmId }),
    repo.itemSnapshots(item, from)
  ]);
  const daily = withDailyDiffs(rawDaily);
  let candles;
  let source;
  if (granularity === '1d') {
    // Cao/thấp trong ngày lấy từ ảnh chụp 15 phút nếu có
    const intraday = {};
    for (const p of points) {
      if (!(p.price > 0)) continue;
      const d = (intraday[utcDay(p.timestamp)] ||= { high: p.price, low: p.price });
      d.high = Math.max(d.high, p.price);
      d.low = Math.min(d.low, p.price);
    }
    candles = candlesFromDaily(daily.filter(d => Date.parse(`${d.date}T00:00:00Z`) >= from - DAY_MS), intraday);
    source = 'daily';
  } else {
    candles = candlesFromSnapshots(points, granularity);
    source = 'snapshots';
  }
  const last30 = daily.filter(d => Date.parse(`${d.date}T00:00:00Z`) >= now - 30 * DAY_MS && d.close > 0);
  const price = snap?.prices?.[item] ?? daily[daily.length - 1]?.close ?? null;
  const supLast = supply[supply.length - 1] || null;
  const today = daily[daily.length - 1] || null;
  return {
    item,
    category: categoryOf(item),
    seasons: seasons.seasonsForItem(item),
    granularity,
    range,
    source,
    candles,
    supply,
    seasonBands: seasons.seasonBands(from, now),
    stats: {
      price,
      bestOffer: snap?.bestOffers?.[item] ?? null,
      listings: snap?.listings?.[item] ?? null,
      offers: snap?.offers?.[item] ?? null,
      change30d: price > 0 && last30[0]?.close > 0 ? price / last30[0].close - 1 : null,
      supply: supLast?.supply ?? null,
      holders: supLast?.holders ?? null,
      volumeToday: today?.volume ?? null,
      tradesToday: today?.trades ?? null,
      candles: candles.length
    },
    signal: signals.signals.find(s => s.item === item) || null,
    taxRate: signals.taxRate,
    updatedAt: snap?.timestamp ?? null
  };
}

// ---------- Nhu cầu theo chapter ----------

function validateDemand(body) {
  const errors = {};
  const source = String(body.source || '').trim();
  if (!source) errors.source = 'Cần nguồn nhu cầu (vd pet_race, weekly_task, bake)';
  const items = {};
  for (const [name, qty] of Object.entries(body.items || {})) {
    const n = Number(qty);
    if (String(name).trim() && n > 0) items[String(name).trim()] = n;
  }
  if (!Object.keys(items).length) errors.items = 'Cần ít nhất 1 tài nguyên với số lượng > 0';
  const chapterWeek = body.chapterWeek == null || body.chapterWeek === '' ? null : Number(body.chapterWeek);
  if (chapterWeek != null && !(Number.isInteger(chapterWeek) && chapterWeek >= 1 && chapterWeek <= 20)) errors.chapterWeek = 'Tuần chapter từ 1 đến 20';
  const season = body.season ? String(body.season) : null;
  if (season && !seasons.SEASONS.includes(season)) errors.season = 'Mùa không hợp lệ';
  if (Object.keys(errors).length) return { errors };
  return {
    doc: {
      source,
      chapter: body.chapter ? String(body.chapter).slice(0, 60) : seasons.chapterAt(Date.now(), CHAPTERS).name,
      chapterWeek,
      season,
      items,
      note: String(body.note || '').slice(0, 200),
      useInScore: !!body.useInScore
    }
  };
}

const demandView = d => ({ ...d, id: String(d._id), _id: undefined });

async function listDemand() {
  return (await demandRepo.list()).map(demandView);
}

async function addDemand(body) {
  const { errors, doc } = validateDemand(body || {});
  if (errors) return { errors };
  clearCache();
  return { demand: demandView(await demandRepo.insert(doc)) };
}

async function updateDemand(id, body) {
  const { errors, doc } = validateDemand(body || {});
  if (errors) return { errors };
  const updated = await demandRepo.update(id, doc);
  if (!updated) return { notFound: true };
  clearCache();
  return { demand: demandView(updated) };
}

async function deleteDemand(id) {
  const ok = await demandRepo.remove(id);
  if (ok) clearCache();
  return ok ? { ok } : { notFound: true };
}

/* ---------- Hàng trong kho (món tự làm ra, tự chọn danh sách) ---------- */

/**
 * Danh sách món trong kho người dùng muốn theo dõi để bán đúng đỉnh (market_meta 'stockWatch').
 * Chưa đặt lần nào thì dùng mặc định Wheat, Stone, Wood, Gold, Crimstone, Milk.
 */
async function getStockItems() {
  const m = await repo.getMeta('stockWatch').catch(() => ({}));
  return Array.isArray(m.items) ? m.items : [...stockPeaks.DEFAULT_STOCK_ITEMS];
}

/** Thêm / bỏ 1 món khỏi danh sách theo dõi kho. Chỉ nhận tài nguyên có trên chợ */
async function setStockItem(item, on) {
  const name = typeof item === 'string' ? item.trim() : '';
  const { isTradeResource } = await getTaxModule();
  if (!name || !isTradeResource(name)) return { errors: ['item'] };
  const list = new Set(await getStockItems());
  if (on) list.add(name);
  else list.delete(name);
  const items = [...list];
  await repo.setMeta('stockWatch', { items });
  clearStockCache();
  return { item: name, on: Boolean(on), items };
}

// Luật bán hàng trong kho: 'p90' (mặc định, giá vào nhóm 10% ngày cao nhất của món) hoặc 'avgpeak' (chạm mức đỉnh TB)
const STOCK_RULE = String(process.env.STOCK_SELL_RULE || '').toLowerCase() === 'avgpeak' ? 'avgpeak' : 'p90';
const stockCache = new Map();
function clearStockCache() {
  stockCache.clear();
}

/**
 * Hàng trong kho: số lượng (từ trạng thái farm đã lưu), giá hiện tại, mức đỉnh trung bình và tín hiệu bán.
 * Không giới hạn số ngày giữ, không có giá vốn. Chỉ đọc DB.
 */
async function getStock(farmIds = []) {
  const { taxRate } = await taxRateForFarm(farmIds[0]);
  const items = await getStockItems();
  const key = `${taxRate}|${items.join(',')}|${farmIds.join(',')}`;
  const hit = stockCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;
  const [snap, states, dailyLists] = await Promise.all([
    repo.latestSnapshot(),
    Promise.all(farmIds.map(id => farmStateRepo.get(id).catch(() => null))),
    Promise.all(items.map(item => repo.itemDaily(item, utcDate(Date.now() - HISTORY_DAYS * DAY_MS))))
  ]);
  const rows = items.map((item, i) => {
    let qty = 0;
    let listedQty = 0;
    let haveState = false;
    for (const st of states) {
      if (!st?.gameData) continue;
      haveState = true;
      qty += Number(st.gameData.inventory?.[item]) || 0;
      listedQty += listingsByItem(st.gameData)[item]?.qty || 0;
    }
    const price = snap?.prices?.[item] ?? null;
    const sig = stockSignal(dailyLists[i], { price, rule: STOCK_RULE });
    const net = taxRate != null ? 1 - taxRate : 1;
    return {
      item,
      qty: haveState ? qty : null,
      listedQty,
      price: sig.price ?? price,
      base: sig.base ?? null,
      target: sig.target ?? null,
      toTarget: sig.toTarget ?? null,
      spikeRatio: sig.spikeRatio ?? null,
      peakTarget: sig.peakTarget ?? null,
      ratioNow: sig.ratioNow ?? null,
      avgRatio: sig.avgRatio ?? null,
      avgPeakPrice: sig.avgPeakPrice ?? null,
      peakCount: sig.peakCount || 0,
      lastPeak: sig.lastPeak || null,
      avgGapDays: sig.avgGapDays ?? null,
      peaks: sig.peaks || [],
      valueNow: haveState && sig.price ? qty * sig.price * net : null,
      valueAtTarget: haveState && sig.target ? qty * sig.target * net : null,
      decision: sig.decision,
      note: sig.reason
    };
  });
  const order = { sell: 0, near: 1, hold: 2, unknown: 3 };
  rows.sort((a, b) => order[a.decision] - order[b.decision] || (b.valueNow || 0) - (a.valueNow || 0));
  const fetchedAt = Math.max(0, ...states.map(s => s?.fetchedAt || 0)) || null;
  const result = { taxRate, updatedAt: snap?.timestamp ?? null, inventoryAt: fetchedAt, rule: { ...stockPeaks.DEFAULTS, rule: STOCK_RULE }, rows };
  stockCache.clear();
  stockCache.set(key, { at: Date.now(), result });
  return result;
}

/* ---------- Mua trữ cho vật nuôi (món mua để dùng, tự chọn danh sách) ---------- */

/** Danh sách món mua trữ (market_meta 'feedWatch'). Chưa đặt lần nào thì dùng mặc định Corn, Wheat, Barley */
async function getFeedItems() {
  const m = await repo.getMeta('feedWatch').catch(() => ({}));
  return Array.isArray(m.items) ? m.items : [...feedBuy.DEFAULT_FEED_ITEMS];
}

/** Thêm / bỏ 1 món khỏi danh sách mua trữ. Chỉ nhận tài nguyên có trên chợ */
async function setFeedItem(item, on) {
  const name = typeof item === 'string' ? item.trim() : '';
  const { isTradeResource } = await getTaxModule();
  if (!name || !isTradeResource(name)) return { errors: ['item'] };
  const list = new Set(await getFeedItems());
  if (on) list.add(name);
  else list.delete(name);
  const items = [...list];
  await repo.setMeta('feedWatch', { items });
  feedCache.clear();
  return { item: name, on: Boolean(on), items };
}

const feedCache = new Map();

/**
 * Mua trữ: với từng món trong danh sách, đang ở khúc rẻ của vòng mùa chưa (Mua trữ / Chờ), giá đáy dự kiến,
 * khúc rẻ sau, số đang có trong kho, và kết quả backtest so với mua đều mỗi ngày. Chỉ đọc DB.
 */
async function getFeed(farmIds = []) {
  const { taxRate } = await taxRateForFarm(farmIds[0]);
  const items = await getFeedItems();
  const key = `${taxRate}|${items.join(',')}|${farmIds.join(',')}`;
  const hit = feedCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;
  const now = Date.now();
  const [snap, states, dailyLists] = await Promise.all([
    repo.latestSnapshot(),
    Promise.all(farmIds.map(id => farmStateRepo.get(id).catch(() => null))),
    Promise.all(items.map(item => repo.itemDaily(item, utcDate(now - HISTORY_DAYS * DAY_MS))))
  ]);
  const rows = items.map((item, i) => {
    let qty = 0;
    let haveState = false;
    for (const st of states) {
      if (!st?.gameData) continue;
      haveState = true;
      qty += Number(st.gameData.inventory?.[item]) || 0;
    }
    const price = snap?.prices?.[item] ?? null;
    const sig = feedBuy.feedSignal(dailyLists[i], { now, price, taxRate: taxRate ?? 0.1 });
    const backtest = sig.decision === 'unknown' ? null : feedBuy.backtestFeed(dailyLists[i]);
    return {
      item,
      qty: haveState ? qty : null,
      decision: sig.decision,
      price: sig.price ?? price,
      level: sig.level ?? null,
      cheapPrice: sig.cheapPrice ?? null,
      discount: sig.discount ?? null,
      inWindow: sig.inWindow ?? false,
      windowLeftDays: sig.windowLeftDays ?? null,
      windowSeasons: sig.windowSeasons || [],
      nextDate: sig.nextDate ?? null,
      nextEndDate: sig.nextEndDate ?? null,
      windowEndDate: sig.windowEndDate ?? null,
      nextInDays: sig.nextInDays ?? null,
      nextPrice: sig.nextPrice ?? null,
      cheaperPct: sig.cheaperPct ?? null,
      peakDate: sig.peakDate ?? null,
      peakPrice: sig.peakPrice ?? null,
      surplusNet: sig.surplusNet ?? null,
      cycleIndex: sig.cycleIndex ?? null,
      backtest,
      note: sig.reason
    };
  });
  const order = { buy: 0, wait: 1, unknown: 2 };
  rows.sort((a, b) => order[a.decision] - order[b.decision] || (a.nextInDays ?? 99) - (b.nextInDays ?? 99));
  const fetchedAt = Math.max(0, ...states.map(st => st?.fetchedAt || 0)) || null;
  const result = { taxRate, updatedAt: snap?.timestamp ?? null, inventoryAt: fetchedAt, rule: feedBuy.DEFAULTS, rows };
  feedCache.clear();
  feedCache.set(key, { at: Date.now(), result });
  return result;
}

module.exports = {
  RANGES,
  getCalendar,
  getOverview,
  getSignals,
  getHoldings,
  setHoldIgnore,
  setHoldListed,
  listState,
  listingsByItem,
  getItemHistory,
  listDemand,
  addDemand,
  updateDemand,
  deleteDemand,
  validateDemand,
  clearCache,
  lavaPitDemand,
  getBacktests,
  getPortfolioBacktest,
  keepTopBuys,
  applyFaction,
  taxRateForFarm,
  getStock,
  getStockItems,
  setStockItem,
  getFeed,
  getFeedItems,
  setFeedItem
};
