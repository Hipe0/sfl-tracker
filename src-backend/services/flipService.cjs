const crypto = require('crypto');
const cron = require('node-cron');
const { getMarketTradesCollection } = require('../config/db.cjs');
const {
  getGameData,
  getMarketPrices,
  fetchMarketplaceActivity,
  fetchMarketplaceProfile,
  farmCache
} = require('./sflApiService.cjs');
const { computeFlip, getTradeSide } = require('./flipCalc.cjs');

// Chỉ ghi thuế "tại thời điểm giao dịch" cho lệnh vừa khớp gần đây; lệnh cũ hơn thì tính theo thuế hiện tại
const FRESH_TRADE_WINDOW_MS = 15 * 60 * 1000;
const REPORT_CACHE_MS = 20 * 1000;
const reportCache = new Map();

let cronTask = null;
let isRunning = false;
const status = {
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastResult: null
};

function parseFarmIds(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,;]+/)
    .map(id => id.trim())
    .filter(id => /^\d+$/.test(id));
}

function getFlipFarmIds() {
  return parseFarmIds(process.env.FLIP_FARM_IDS);
}

/**
 * Tính năng FLIP chỉ bật khi FLIP_ENABLED=true, có FLIP_OWNER_KEY và ít nhất một farm trong FLIP_FARM_IDS
 */
function isFlipEnabled() {
  return process.env.FLIP_ENABLED === 'true'
    && !!process.env.FLIP_OWNER_KEY
    && getFlipFarmIds().length > 0;
}

function keysMatch(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Middleware: sai/thiếu mã (header x-flip-key) hoặc farm không thuộc FLIP_FARM_IDS thì trả 404 như route không tồn tại
 */
function requireFlipOwner(req, res, next) {
  if (!isFlipEnabled() || !keysMatch(req.headers['x-flip-key'], process.env.FLIP_OWNER_KEY)) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND' });
  }
  if (req.params.farmId && !getFlipFarmIds().includes(String(req.params.farmId))) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND' });
  }
  next();
}

let taxModule = null;
function getTaxModule() {
  // src/utils/taxCalculator.js là ESM dùng chung với frontend (require ESM cần Node >= 22.12)
  if (!taxModule) taxModule = require('../../src/utils/taxCalculator.js');
  return taxModule;
}

let idMapCache = null;
function getIdMap() {
  if (!idMapCache) idMapCache = require('../../src/data/idMap.json');
  return idMapCache;
}

function resolveName(trade) {
  return getIdMap()[`${trade.collection}-${trade.itemId}`] || `Item #${trade.itemId}`;
}

/**
 * Lấy lịch sử giao dịch mới nhất của một farm và lưu vào market_trades
 */
async function syncFlipFarmTrades(farmId) {
  const collection = getMarketTradesCollection();
  // Bỏ cache 3 phút của marketplaceProfile để chu kỳ 1-2 phút thật sự lấy dữ liệu mới
  farmCache.del(`market_profile_${farmId}`);
  const data = await fetchMarketplaceProfile(farmId, false);
  const trades = Array.isArray(data?.trades) ? data.trades : [];
  if (trades.length === 0) return { farmId, trades: 0, taxStamped: 0 };

  let flowerUsdPrice = 0;
  try {
    flowerUsdPrice = (await fetchMarketplaceActivity())?.flowerUsdPrice || 0;
  } catch (e) {
    console.warn('[Flip] Không lấy được giá FLOWER/USD:', e.message);
  }

  await collection.bulkWrite(trades.map(trade => ({
    updateOne: {
      filter: { id: trade.id },
      update: {
        $set: { ...trade, farmId: Number(farmId) },
        $setOnInsert: { usdPriceAtTrade: flowerUsdPrice }
      },
      upsert: true
    }
  })), { ordered: false });

  // Ghi lại mức thuế đang áp dụng cho các lệnh bán vừa khớp của farm này
  const { calculateTradeTax } = getTaxModule();
  const freshSells = trades.filter(t =>
    t.fulfilledAt >= Date.now() - FRESH_TRADE_WINDOW_MS && getTradeSide(t, farmId) === 'sell'
  );
  let taxStamped = 0;
  if (freshSells.length > 0) {
    const gameData = await getGameData(farmId, false);
    const ops = freshSells.map(t => ({
      updateOne: {
        filter: { id: t.id, taxRateAtTrade: { $exists: false } },
        update: { $set: { taxRateAtTrade: calculateTradeTax(resolveName(t), gameData) } }
      }
    }));
    const result = await collection.bulkWrite(ops, { ordered: false });
    taxStamped = result.modifiedCount || 0;
  }

  return { farmId, trades: trades.length, taxStamped };
}

async function syncAllFlipFarms() {
  if (isRunning) return { skipped: true };
  isRunning = true;
  status.lastRunAt = new Date().toISOString();
  try {
    const results = [];
    for (const farmId of getFlipFarmIds()) {
      try {
        results.push(await syncFlipFarmTrades(farmId));
      } catch (e) {
        results.push({ farmId, error: e.message });
      }
    }
    status.lastResult = results;
    reportCache.clear();
    const failed = results.filter(r => r.error);
    status.lastError = failed.length ? failed.map(r => `${r.farmId}: ${r.error}`).join('; ') : null;
    if (!failed.length) status.lastSuccessAt = new Date().toISOString();
    return { results };
  } finally {
    isRunning = false;
  }
}

/**
 * Bật cron lưu giao dịch cho các farm trong FLIP_FARM_IDS (mặc định 2 phút một lần)
 */
function startFlipSync() {
  if (!isFlipEnabled() || cronTask) return cronTask;
  const schedule = process.env.FLIP_SYNC_CRON || '*/2 * * * *';
  if (!cron.validate(schedule)) {
    console.error(`[Flip] FLIP_SYNC_CRON không hợp lệ: "${schedule}"`);
    return null;
  }
  const run = () => syncAllFlipFarms()
    .then(r => {
      if (r.skipped) return;
      const summary = r.results.map(x => x.error ? `${x.farmId} lỗi` : `${x.farmId}: ${x.trades} lệnh`).join(', ');
      console.log(`[Flip] Đã lưu giao dịch (${summary})`);
    })
    .catch(e => console.error('[Flip] Lỗi đồng bộ:', e.message));
  cronTask = cron.schedule(schedule, run);
  run();
  console.log(`[Flip] Lưu giao dịch theo lịch "${schedule}" cho ${getFlipFarmIds().length} farm`);
  return cronTask;
}

function getFlipStatus() {
  return { ...status, running: isRunning, scheduled: !!cronTask, farms: getFlipFarmIds() };
}

function parseTime(value, endOfDay = false) {
  if (value == null || value === '') return null;
  if (/^\d+$/.test(String(value))) return Number(value);
  // "YYYY-MM-DD" hiểu theo múi giờ FLIP_TZ_OFFSET_MINUTES
  const tz = Number(process.env.FLIP_TZ_OFFSET_MINUTES ?? 420);
  const base = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(base)) return null;
  return base - tz * 60 * 1000 + (endOfDay ? 24 * 60 * 60 * 1000 - 1 : 0);
}

/**
 * Tính báo cáo FLIP cho một farm
 * @param {object} query { from, to, category: 'resource' | 'nft' | 'all' }
 */
async function buildFlipReport(farmId, query = {}) {
  const category = ['resource', 'nft', 'all'].includes(query.category) ? query.category : 'resource';
  // Excel làm mới nhiều bảng cùng lúc: dùng chung một lần tính trong vài giây
  const cacheKey = JSON.stringify([String(farmId), category, query.from ?? null, query.to ?? null]);
  const cached = reportCache.get(cacheKey);
  if (cached && Date.now() - cached.at < REPORT_CACHE_MS) return cached.promise;
  const promise = computeFlipReport(farmId, { ...query, category });
  reportCache.set(cacheKey, { at: Date.now(), promise });
  promise.catch(() => reportCache.delete(cacheKey));
  return promise;
}

async function computeFlipReport(farmId, query) {
  const { calculateTradeTax, isTradeResource } = getTaxModule();
  const { category } = query;
  const id = Number(farmId);

  const trades = await getMarketTradesCollection()
    .find({ $or: [{ 'initiatedBy.id': id }, { 'fulfilledBy.id': id }] })
    .toArray();

  const gameData = await getGameData(farmId, true);
  let marketPrices = {};
  try {
    marketPrices = (await getMarketPrices())?.prices || {};
  } catch (e) {
    console.warn('[Flip] Không lấy được giá thị trường:', e.message);
  }

  const report = computeFlip(trades, {
    farmId,
    resolveName,
    taxRateFor: (trade, name) => trade.taxRateAtTrade ?? calculateTradeTax(name, gameData),
    currentTaxRateFor: name => calculateTradeTax(name, gameData),
    includeItem: name => category === 'all' || (category === 'resource') === isTradeResource(name),
    from: parseTime(query.from),
    to: parseTime(query.to, true),
    tzOffsetMinutes: Number(process.env.FLIP_TZ_OFFSET_MINUTES ?? 420),
    marketPrices
  });

  return {
    farmId: String(farmId),
    category,
    generatedAt: new Date().toISOString(),
    tradeCount: trades.length,
    sync: getFlipStatus(),
    ...report
  };
}

module.exports = {
  isFlipEnabled,
  requireFlipOwner,
  getFlipFarmIds,
  syncFlipFarmTrades,
  syncAllFlipFarms,
  startFlipSync,
  getFlipStatus,
  buildFlipReport,
  parseTime,
  keysMatch
};
