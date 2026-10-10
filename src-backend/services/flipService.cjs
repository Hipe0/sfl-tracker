const crypto = require('crypto');
const path = require('path');
const { pathToFileURL } = require('url');
const { ObjectId } = require('mongodb');
const { getMarketTradesCollection, getMarketPricesCollection, getCollection } = require('../config/db.cjs');
const { sflCommunityQueue } = require('../utils/apiQueue.cjs');
const {
  getGameData,
  getMarketPrices,
  getSyncInfo,
  fetchMarketplaceActivity,
  fetchMarketplaceProfile,
  farmCache
} = require('./sflApiService.cjs');
const { computeFlip, getTradeSide } = require('./flipCalc.cjs');
const { reconcileGap } = require('./flipReconcile.cjs');
const scheduler = require('./flipScheduler.cjs');

// Chỉ ghi thuế "tại thời điểm giao dịch" cho lệnh vừa khớp gần đây; lệnh cũ hơn thì tính theo thuế hiện tại
const FRESH_TRADE_WINDOW_MS = 15 * 60 * 1000;
const REPORT_CACHE_MS = 20 * 1000;
// API marketplaceProfile chỉ trả về chừng này giao dịch gần nhất
const PROFILE_TRADE_LIMIT = 50;
// Có người dùng đang chờ trong hàng đợi API thì lùi lượt lấy giao dịch lại chừng này
const YIELD_RETRY_MS = 3000;
// Lỗ hổng chờ quá lâu mà chưa có ảnh chụp farm sau đó thì thôi, chỉ cảnh báo
const GAP_RESOLVE_TIMEOUT_MS = 15 * 60 * 1000;
const FOCUS_WINDOW_MS = 10 * 60 * 1000;
const REF_PRICE_WINDOW_MS = 30 * 60 * 1000;
const SNAPSHOT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const reportCache = new Map();
const farmStates = new Map(); // farmId -> trạng thái nhịp lấy giao dịch
const timers = new Map();
let started = false;
const status = {
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastResult: null
};

const col = {
  state: () => getCollection('flip_state'),
  snapshots: () => getCollection('flip_snapshots'),
  gaps: () => getCollection('flip_gaps'),
  adjustments: () => getCollection('flip_adjustments')
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
  // src/utils/taxCalculator.js là ESM dùng chung với frontend: import() chạy được trên mọi bản Node của host
  if (!taxModule) {
    const url = pathToFileURL(path.join(__dirname, '../../src/utils/taxCalculator.js')).href;
    taxModule = import(url).catch(err => {
      taxModule = null;
      throw err;
    });
  }
  return taxModule;
}

let idMapCache = null;
function getIdMap() {
  if (!idMapCache) idMapCache = require('../../src/data/idMap.json');
  return idMapCache;
}

function resolveName(trade) {
  if (trade.itemName) return trade.itemName;
  return getIdMap()[`${trade.collection}-${trade.itemId}`] || `Item #${trade.itemId}`;
}

function getFarmState(farmId) {
  const key = String(farmId);
  if (!farmStates.has(key)) farmStates.set(key, scheduler.createFarmState());
  return farmStates.get(key);
}

function farmTradesQuery(farmId) {
  const id = Number(farmId);
  return { $or: [{ 'initiatedBy.id': id }, { 'fulfilledBy.id': id }] };
}

// ---------- Ảnh chụp kho đồ + số dư để bù lệnh bị sót ----------

async function saveSnapshot(farmId, isTradeResource) {
  const gameData = await getGameData(farmId, false);
  const fetchedAt = getSyncInfo(farmId).fetchedAt;
  if (!gameData || !fetchedAt) return null;
  const at = Date.parse(fetchedAt);
  const inventory = {};
  for (const [name, qty] of Object.entries(gameData.inventory || {})) {
    if (isTradeResource(name)) inventory[name] = Number(qty) || 0;
  }
  const doc = { farmId: String(farmId), at, balance: Number(gameData.balance) || 0, inventory };
  await col.snapshots().updateOne({ farmId: doc.farmId, at }, { $setOnInsert: doc }, { upsert: true });
  await col.snapshots().deleteMany({ farmId: doc.farmId, at: { $lt: Date.now() - SNAPSHOT_RETENTION_MS } });
  return doc;
}

/**
 * Giá tham chiếu mỗi đơn vị: trung bình các lệnh cùng món cùng chiều quanh khoảng bị sót,
 * nếu không có thì lấy lịch sử giá thị trường, cuối cùng là giá hiện tại
 */
async function buildRefPrice(farmId, gap, trades, taxFor) {
  const near = trades.filter(t => Math.abs(t.fulfilledAt - (gap.from + gap.to) / 2) <= REF_PRICE_WINDOW_MS);
  const avg = {};
  for (const t of near) {
    const side = getTradeSide(t, farmId);
    if (!side) continue;
    const item = resolveName(t);
    const key = `${item}|${side}`;
    const unitNet = side === 'sell' ? (t.sfl * (1 - taxFor(t, item))) / t.quantity : t.sfl / t.quantity;
    avg[key] ||= { sum: 0, n: 0 };
    avg[key].sum += unitNet * t.quantity;
    avg[key].n += t.quantity;
  }

  let historical = null;
  try {
    const prices = getMarketPricesCollection();
    if (prices) {
      historical = await prices.find({ timestamp: { $lte: gap.to } }).sort({ timestamp: -1 }).limit(1).next();
    }
  } catch { /* không có lịch sử giá thì bỏ qua */ }
  let current = {};
  try {
    current = (await getMarketPrices())?.prices || {};
  } catch { /* bỏ qua */ }

  return (item, side) => {
    const a = avg[`${item}|${side}`];
    if (a && a.n > 0) return a.sum / a.n;
    const market = historical?.prices?.[item] ?? current[item];
    if (!(market > 0)) return null;
    return side === 'sell' ? market * (1 - taxFor({}, item)) : market;
  };
}

async function resolvePendingGaps(farmId, gameData) {
  const { calculateTradeTax, isTradeResource } = await getTaxModule();
  const taxFor = (trade, item) => trade.taxRateAtTrade ?? calculateTradeTax(item, gameData);
  const pending = await col.gaps().find({ farmId: String(farmId), status: 'pending' }).toArray();
  let resolved = 0;

  for (const gap of pending) {
    const before = await col.snapshots().find({ farmId: String(farmId), at: { $lte: gap.from } }).sort({ at: -1 }).limit(1).next();
    const after = await col.snapshots().find({ farmId: String(farmId), at: { $gte: gap.to } }).sort({ at: 1 }).limit(1).next();
    if (!before || !after) {
      if (Date.now() - gap.detectedAt > GAP_RESOLVE_TIMEOUT_MS) {
        await col.gaps().updateOne({ _id: gap._id }, { $set: { status: 'unresolved', reason: 'missing_snapshot', resolvedAt: Date.now() } });
      }
      continue;
    }

    const windowTrades = await getMarketTradesCollection()
      .find({ ...farmTradesQuery(farmId), fulfilledAt: { $gt: before.at - REF_PRICE_WINDOW_MS, $lte: after.at + REF_PRICE_WINDOW_MS } })
      .toArray();
    const priorAdjustments = await col.adjustments().find({ farmId: String(farmId), at: { $gt: before.at, $lte: after.at } }).toArray();

    const captured = [];
    for (const t of windowTrades) {
      if (!(t.fulfilledAt > before.at && t.fulfilledAt <= after.at)) continue;
      const side = getTradeSide(t, farmId);
      if (!side) continue;
      const item = resolveName(t);
      captured.push(side === 'buy'
        ? { side, item, qty: t.quantity, cost: t.sfl }
        : { side, item, qty: t.quantity, net: t.sfl * (1 - taxFor(t, item)) });
    }
    // Lệnh bù trước đó trong cùng khoảng cũng tính như đã bắt được, để không bù hai lần
    for (const a of priorAdjustments) {
      captured.push(a.side === 'buy'
        ? { side: 'buy', item: a.item, qty: a.qty, cost: a.sfl }
        : { side: 'sell', item: a.item, qty: a.qty, net: a.sfl });
    }

    const focusItems = [...new Set(windowTrades
      .filter(t => t.fulfilledAt >= gap.from - FOCUS_WINDOW_MS && t.fulfilledAt <= gap.to + FOCUS_WINDOW_MS)
      .map(resolveName))];

    const result = reconcileGap({
      before,
      after,
      captured,
      isTradeable: isTradeResource,
      focusItems,
      refPrice: await buildRefPrice(farmId, gap, windowTrades, taxFor),
      at: Math.round((gap.from + gap.to) / 2)
    });

    let adjustmentIds = [];
    if (result.status === 'resolved' && result.adjustments.length) {
      const docs = result.adjustments.map(a => ({
        farmId: String(farmId),
        item: a.item,
        side: a.side,
        qty: a.qty,
        sfl: a.sfl,
        at: a.at,
        source: 'estimate',
        gapId: gap._id,
        note: result.reason === 'estimated_mixed' ? 'Ước tính theo giá tham chiếu (vừa mua vừa bán)' : 'Ước tính theo kho đồ và số dư FLOWER',
        createdAt: Date.now()
      }));
      const inserted = await col.adjustments().insertMany(docs);
      adjustmentIds = Object.values(inserted.insertedIds);
      resolved++;
    }
    await col.gaps().updateOne({ _id: gap._id }, {
      $set: {
        status: result.status,
        reason: result.reason,
        unexplainedSfl: result.unexplainedSfl ?? null,
        unexplainedItems: (result.unexplainedItems || []).slice(0, 20),
        adjustmentIds,
        resolvedAt: Date.now()
      }
    });
  }
  return resolved;
}

// ---------- Lấy giao dịch ----------

/**
 * Phát hiện bị sót: cả 50 lệnh trả về đều mới (không chồng lên lệnh đã lưu) thì có thể đã trôi mất lệnh ở giữa.
 * totalTrades (tổng giao dịch của farm) cho biết sót bao nhiêu; không có thì để null.
 */
function detectGap({ trades, newCount, lastStoredAt, lastTotalTrades, totalTrades }) {
  if (trades.length < PROFILE_TRADE_LIMIT || newCount < trades.length || lastStoredAt == null) return null;
  const counted = lastTotalTrades != null && totalTrades != null ? totalTrades - lastTotalTrades - newCount : null;
  if (counted != null && counted <= 0) return null;
  return {
    from: lastStoredAt,
    to: Math.min(...trades.map(t => t.fulfilledAt)),
    missingCount: counted
  };
}

/**
 * Lấy 50 giao dịch mới nhất của một farm, lưu vào market_trades, phát hiện và bù lệnh bị sót
 */
async function syncFlipFarmTrades(farmId) {
  // Có người dùng đang chờ trong hàng đợi API thì nhường lượt
  if (sflCommunityQueue.hasPriorityWaiting()) return { farmId, deferred: true };

  const collection = getMarketTradesCollection();
  const { calculateTradeTax, isTradeResource } = await getTaxModule();

  // Bỏ cache 3 phút của marketplaceProfile để mỗi lượt thật sự lấy dữ liệu mới.
  // Xếp lên đầu hàng (trước các tác vụ nền như tải đấu giá cũ): lúc này không có người dùng nào đang chờ,
  // người dùng đến sau vẫn được chen lên trước
  farmCache.del(`market_profile_${farmId}`);
  const data = await fetchMarketplaceProfile(farmId, true);
  const trades = Array.isArray(data?.trades) ? data.trades : [];
  const pollAt = Date.now();

  const known = new Set((await collection
    .find({ id: { $in: trades.map(t => t.id) } }, { projection: { id: 1 } })
    .toArray()).map(t => t.id));
  const newTrades = trades.filter(t => !known.has(t.id));
  const lastBefore = await collection.find(farmTradesQuery(farmId)).sort({ fulfilledAt: -1 }).limit(1).next();

  if (trades.length) {
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
  }

  // Ghi lại mức thuế đang áp dụng cho các lệnh bán vừa khớp của farm này
  const gameData = await getGameData(farmId, false);
  const freshSells = trades.filter(t =>
    t.fulfilledAt >= Date.now() - FRESH_TRADE_WINDOW_MS && getTradeSide(t, farmId) === 'sell'
  );
  if (freshSells.length > 0) {
    await collection.bulkWrite(freshSells.map(t => ({
      updateOne: {
        filter: { id: t.id, taxRateAtTrade: { $exists: false } },
        update: { $set: { taxRateAtTrade: calculateTradeTax(resolveName(t), gameData) } }
      }
    })), { ordered: false });
  }

  const stateDoc = await col.state().findOne({ _id: String(farmId) });
  const totalTrades = Number.isFinite(Number(data?.totalTrades)) ? Number(data.totalTrades) : null;
  const gapInfo = detectGap({
    trades,
    newCount: newTrades.length,
    lastStoredAt: lastBefore?.fulfilledAt ?? null,
    lastTotalTrades: stateDoc?.lastTotalTrades ?? null,
    totalTrades
  });
  let gap = null;
  if (gapInfo) {
    gap = { farmId: String(farmId), detectedAt: pollAt, ...gapInfo, status: 'pending' };
    await col.gaps().insertOne(gap);
    console.warn(`[Flip] Farm ${farmId}: có thể sót ${gap.missingCount ?? 'một số'} giao dịch từ ${new Date(gap.from).toISOString()} đến ${new Date(gap.to).toISOString()}`);
  }
  await col.state().updateOne(
    { _id: String(farmId) },
    { $set: { lastTotalTrades: totalTrades, lastPollAt: pollAt } },
    { upsert: true }
  );

  await saveSnapshot(farmId, isTradeResource);
  const estimated = await resolvePendingGaps(farmId, gameData);

  return {
    farmId,
    trades: trades.length,
    newTrades: newTrades.length,
    newestFulfilledAt: trades.length ? Math.max(...trades.map(t => t.fulfilledAt)) : null,
    gapDetected: !!gap,
    gapsEstimated: estimated
  };
}

function recordResult(result) {
  status.lastRunAt = new Date().toISOString();
  status.lastResult = result;
  if (result.error) {
    status.lastError = `${result.farmId}: ${result.error}`;
  } else {
    status.lastError = null;
    status.lastSuccessAt = status.lastRunAt;
  }
  reportCache.clear();
}

async function pollFarm(farmId) {
  const config = scheduler.getSchedulerConfig();
  const state = getFarmState(farmId);
  // Lượt trước chưa xong (ví dụ vừa bấm "Đang gom hàng"): lượt đó tự đặt lịch tiếp khi xong
  if (state.polling) return;
  state.polling = true;
  let delay;
  try {
    const result = await syncFlipFarmTrades(farmId);
    if (result.deferred) {
      delay = YIELD_RETRY_MS;
    } else {
      recordResult(result);
      const before = state.mode;
      scheduler.applyPollResult(state, result, Date.now(), config);
      if (before !== state.mode) console.log(`[Flip] Farm ${farmId}: chuyển sang nhịp ${state.mode === 'fast' ? 'nhanh' : 'thường'}`);
      delay = scheduler.nextDelay(state, Date.now(), config);
    }
  } catch (e) {
    recordResult({ farmId, error: e.message });
    console.error(`[Flip] Lỗi lấy giao dịch farm ${farmId}:`, e.message);
    delay = scheduler.nextDelay(state, Date.now(), config);
  } finally {
    state.polling = false;
  }
  scheduleFarm(farmId, delay);
}

function scheduleFarm(farmId, delay) {
  clearTimeout(timers.get(String(farmId)));
  const state = getFarmState(farmId);
  state.nextPollAt = Date.now() + delay;
  timers.set(String(farmId), setTimeout(() => pollFarm(farmId), delay));
}

async function syncAllFlipFarms() {
  const results = [];
  for (const farmId of getFlipFarmIds()) {
    try {
      const result = await syncFlipFarmTrades(farmId);
      if (!result.deferred) recordResult(result);
      results.push(result);
    } catch (e) {
      recordResult({ farmId, error: e.message });
      results.push({ farmId, error: e.message });
    }
  }
  return { results };
}

/**
 * Bật vòng lấy giao dịch cho các farm trong FLIP_FARM_IDS: 1 phút một lần, đang gom hàng thì 10 giây
 */
function startFlipSync() {
  if (!isFlipEnabled() || started) return started;
  started = true;
  const config = scheduler.getSchedulerConfig();
  getFlipFarmIds().forEach((farmId, i) => scheduleFarm(farmId, 2000 + i * 1000));
  console.log(`[Flip] Lấy giao dịch cho ${getFlipFarmIds().length} farm: thường ${config.normalMs / 1000}s, gom hàng ${config.fastMs / 1000}s`);
  return started;
}

/**
 * Nút "Đang gom hàng": chạy nhịp nhanh ngay trong vài phút, không chờ tự phát hiện
 */
function startBurst(farmId, minutes) {
  const config = scheduler.getSchedulerConfig();
  const state = getFarmState(farmId);
  scheduler.startManualBurst(state, Date.now(), config, Number(minutes) || 0);
  if (started) scheduleFarm(farmId, 0);
  return getFarmSchedule(farmId);
}

function stopBurst(farmId) {
  const state = getFarmState(farmId);
  state.manualUntil = 0;
  state.mode = 'normal';
  if (started) scheduleFarm(farmId, scheduler.getSchedulerConfig().normalMs);
  return getFarmSchedule(farmId);
}

function getFarmSchedule(farmId) {
  const s = getFarmState(farmId);
  const now = Date.now();
  return {
    mode: s.manualUntil > now ? 'fast' : s.mode,
    manualUntil: s.manualUntil > now ? s.manualUntil : null,
    lastPollAt: s.lastPollAt,
    nextPollAt: s.nextPollAt || null,
    lastNewTradeAt: s.lastNewTradeAt
  };
}

function getFlipStatus() {
  return {
    ...status,
    running: started,
    scheduled: started,
    farms: getFlipFarmIds(),
    schedule: Object.fromEntries(getFlipFarmIds().map(id => [id, getFarmSchedule(id)]))
  };
}

// ---------- Lệnh bù / nhập tay ----------

function parseAt(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return Number(value);
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
}

/**
 * Kiểm tra dữ liệu lệnh nhập tay. Người dùng nhập giá mỗi cái (price); tổng SFL = qty × price.
 * Lệnh bán: price là giá niêm yết (trước thuế), thuế được trừ khi tính lãi.
 */
function validateAdjustment(body, partial = false) {
  const out = {};
  const errors = [];
  if (!partial || body.item !== undefined) {
    const item = typeof body.item === 'string' ? body.item.trim() : '';
    if (!item || item.length > 60) errors.push('item');
    else out.item = item;
  }
  if (!partial || body.side !== undefined) {
    if (!['buy', 'sell'].includes(body.side)) errors.push('side');
    else out.side = body.side;
  }
  if (!partial || body.qty !== undefined) {
    const qty = Number(body.qty);
    if (!(qty > 0)) errors.push('qty');
    else out.qty = qty;
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (body.price === undefined || body.price === '' || !(price >= 0)) errors.push('price');
    else out.price = price;
  }
  if (!partial || body.at !== undefined) {
    const at = parseAt(body.at);
    if (at == null) errors.push('at');
    else out.at = at;
  }
  if (body.note !== undefined) out.note = String(body.note).slice(0, 200);
  return { value: out, errors };
}

/**
 * Tính tổng SFL và thuế cho lệnh nhập tay theo giá mỗi cái
 */
async function priceAdjustment(farmId, doc) {
  const next = { ...doc };
  if (next.price != null && next.qty != null) next.sfl = next.qty * next.price;
  if (next.side === 'sell') {
    const { calculateTradeTax } = await getTaxModule();
    const gameData = await getGameData(farmId, false);
    next.taxRate = calculateTradeTax(next.item, gameData);
  } else {
    next.taxRate = null;
  }
  return next;
}

async function addAdjustment(farmId, body) {
  const { value, errors } = validateAdjustment(body);
  if (errors.length) return { errors };
  const doc = await priceAdjustment(farmId, { farmId: String(farmId), ...value, source: 'manual', createdAt: Date.now() });
  const { insertedId } = await col.adjustments().insertOne(doc);
  reportCache.clear();
  return { adjustment: { ...doc, _id: insertedId } };
}

function toObjectId(id) {
  try { return new ObjectId(String(id)); } catch { return null; }
}

async function updateAdjustment(farmId, id, body) {
  const _id = toObjectId(id);
  if (!_id) return { notFound: true };
  const { value, errors } = validateAdjustment(body, true);
  if (errors.length) return { errors };
  const existing = await col.adjustments().findOne({ _id, farmId: String(farmId) });
  if (!existing) return { notFound: true };
  // Lệnh ước tính cũ chưa có giá mỗi cái: suy ra từ tổng SFL
  const base = { ...existing, price: existing.price ?? (existing.qty > 0 ? existing.sfl / existing.qty : 0) };
  // Sửa lệnh ước tính thì coi như đã được người dùng xác nhận
  const merged = await priceAdjustment(farmId, { ...base, ...value, editedAt: Date.now(), source: 'manual' });
  const { _id: _ignoredId, ...fields } = merged;
  await col.adjustments().updateOne({ _id }, { $set: fields });
  reportCache.clear();
  return { adjustment: { ...fields, _id } };
}

async function deleteAdjustment(farmId, id) {
  const _id = toObjectId(id);
  if (!_id) return { notFound: true };
  const { deletedCount } = await col.adjustments().deleteOne({ _id, farmId: String(farmId) });
  reportCache.clear();
  return deletedCount ? { deleted: true } : { notFound: true };
}

// ---------- Báo cáo ----------

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
 * Lệnh bù/nhập tay đổi sang dạng giao dịch để ghép FIFO chung. Lệnh bán đã là SFL sau thuế nên thuế = 0.
 */
function adjustmentToTrade(adj, farmId) {
  const me = { id: Number(farmId) };
  const other = { id: 0 };
  return {
    id: `adj-${adj._id}`,
    itemName: adj.item,
    quantity: adj.qty,
    sfl: adj.sfl,
    fulfilledAt: adj.at,
    source: 'listing',
    initiatedBy: adj.side === 'sell' ? me : other,
    fulfilledBy: adj.side === 'sell' ? other : me,
    // Lệnh bù ước tính đã là SFL sau thuế (thuế 0); lệnh nhập tay lưu giá trước thuế kèm mức thuế
    taxRateAtTrade: adj.side === 'sell' ? (adj.taxRate ?? 0) : undefined,
    flipSource: adj.source
  };
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
  const { calculateTradeTax, isTradeResource } = await getTaxModule();
  const { category } = query;

  const [trades, adjustments, gaps] = await Promise.all([
    getMarketTradesCollection().find(farmTradesQuery(farmId)).toArray(),
    col.adjustments().find({ farmId: String(farmId) }).sort({ at: -1 }).toArray(),
    col.gaps().find({ farmId: String(farmId) }).sort({ detectedAt: -1 }).limit(100).toArray()
  ]);

  const gameData = await getGameData(farmId, true);
  let marketPrices = {};
  try {
    marketPrices = (await getMarketPrices())?.prices || {};
  } catch (e) {
    console.warn('[Flip] Không lấy được giá thị trường:', e.message);
  }

  const allTrades = trades.concat(adjustments.map(a => adjustmentToTrade(a, farmId)));
  const report = computeFlip(allTrades, {
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

  // Cột "Đang giữ" lấy số lượng thật trong kho đồ từ API (gồm cả đồ tự farm), không phải số lô FIFO còn lại
  const inventory = gameData?.inventory || {};
  for (const r of report.resources) r.inventoryQty = Number(inventory[r.item]) || 0;

  const openGaps = gaps.filter(g => g.status !== 'resolved');
  return {
    farmId: String(farmId),
    category,
    generatedAt: new Date().toISOString(),
    tradeCount: trades.length,
    sync: getFlipStatus(),
    schedule: getFarmSchedule(farmId),
    ...report,
    adjustments: adjustments.map(a => ({
      id: String(a._id),
      item: a.item,
      side: a.side,
      qty: a.qty,
      price: a.price ?? (a.qty > 0 ? a.sfl / a.qty : null),
      sfl: a.sfl,
      taxRate: a.taxRate ?? null,
      at: a.at,
      source: a.source,
      note: a.note || '',
      gapId: a.gapId ? String(a.gapId) : null
    })),
    gaps: gaps.map(g => ({
      id: String(g._id),
      detectedAt: g.detectedAt,
      from: g.from,
      to: g.to,
      missingCount: g.missingCount,
      status: g.status,
      reason: g.reason || null,
      estimatedCount: (g.adjustmentIds || []).length
    })),
    warnings: {
      openGaps: openGaps.length,
      missingTrades: openGaps.reduce((acc, g) => acc + (g.missingCount || 0), 0),
      estimatedAdjustments: adjustments.filter(a => a.source === 'estimate').length
    }
  };
}

module.exports = {
  isFlipEnabled,
  requireFlipOwner,
  getFlipFarmIds,
  syncFlipFarmTrades,
  syncAllFlipFarms,
  startFlipSync,
  startBurst,
  stopBurst,
  getFlipStatus,
  buildFlipReport,
  addAdjustment,
  updateAdjustment,
  deleteAdjustment,
  validateAdjustment,
  adjustmentToTrade,
  detectGap,
  parseTime,
  keysMatch
};
