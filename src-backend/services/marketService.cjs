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
const { cyclePlan, simulatePortfolio } = require('../domain/seasonCycle.cjs');
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

/** Chỉ báo Mua cho N món tốt nhất cùng lúc (tập trung vốn vào ít lệnh). Đặt MARKET_TOP_N để đổi. */
const TOP_N = Math.max(1, Number(process.env.MARKET_TOP_N) || 3);
// 'trough' = canh đáy, đặt offer ở giá đáy dự kiến (mặc định); 'now' = mua ngay ở giá sàn
const BUY_MODE = process.env.MARKET_BUY_MODE === 'now' ? 'now' : 'trough';
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
    keepTopBuys(signals);
    const order = { buy: 0, sell: 1, wait: 2, avoid: 3, none: 4 };
    signals.sort((a, b) => order[a.decision] - order[b.decision] || (a.rank ?? 99) - (b.rank ?? 99) || (b.score ?? -1) - (a.score ?? -1));
    const portfolio = getPortfolioBacktest(dailyBy, taxRate);
    return { taxRate, taxFromFarm: fromFarm, updatedAt: snap?.timestamp ?? null, topN: TOP_N, buyMode: BUY_MODE, portfolio, signals };
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
  const dateIn = d => utcDate(now + d * DAY_MS);
  const rows = [];
  reports.forEach((report, i) => {
    const held = (report?.resources || []).map(r => ({ item: r.item, qty: r.openQty, cost: r.openCost, oldestBuyAt: r.sessionStartedAt }));
    for (const h of held) {
      if (!(h.qty > 0)) continue;
      const sig = bySignal.get(h.item);
      const avgCost = h.cost / h.qty;
      const price = sig?.price ?? null;
      const cycle = sig?.cycle;
      const target = cycle ? Math.max(cycle.holdPeakPrice, price || 0) : sig?.sellTarget ?? null;
      const net = p => (p > 0 && avgCost > 0 ? p * (1 - taxRate) / avgCost - 1 : null);
      let action;
      let note;
      if (!sig || !price) {
        action = 'unknown';
        note = 'Chưa có giá trên chợ';
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
        note = `Treo bán ${target.toPrecision(4)}, đỉnh dự kiến khoảng ${dateIn(cycle.holdPeakInDays)}; quá ngày đó chưa khớp thì bán ở giá thị trường`;
      } else {
        action = 'hold';
        note = 'Chưa đủ dữ liệu vòng mùa, theo dõi tay';
      }
      rows.push({
        farmId: farmIds[i],
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
        sellBy: cycle ? dateIn(cycle.holdPeakInDays) : null,
        decision: sig?.decision ?? 'none',
        action,
        note
      });
    }
  });
  const order = { sell_now: 0, hold: 1, unknown: 2 };
  rows.sort((a, b) => order[a.action] - order[b.action] || b.cost - a.cost);
  return { taxRate, rows };
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

module.exports = {
  RANGES,
  getCalendar,
  getOverview,
  getSignals,
  getHoldings,
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
  taxRateForFarm
};
