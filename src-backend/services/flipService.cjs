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
const flipUsers = require('./flipUsers.cjs');
const marketRepo = require('../repositories/marketRepository.cjs');
const farmStateRepo = require('../repositories/farmStateRepository.cjs');

// Chỉ ghi thuế "tại thời điểm giao dịch" cho lệnh vừa khớp gần đây; lệnh cũ hơn thì tính theo thuế hiện tại
const FRESH_TRADE_WINDOW_MS = 15 * 60 * 1000;
const REPORT_CACHE_MS = 20 * 1000;
// API marketplaceProfile chỉ trả về chừng này giao dịch gần nhất
const PROFILE_TRADE_LIMIT = 50;
// Có người dùng đang chờ trong hàng đợi API thì lùi lượt lấy giao dịch lại chừng này
const YIELD_RETRY_MS = 3000;
// Bị SFL chặn (429): lùi dần 30s, 60s, 120s... tối đa 5 phút, thay vì cứ 10s/60s lại gọi tiếp
const RATE_LIMIT_BACKOFF_MS = 75 * 1000;
const RATE_LIMIT_BACKOFF_MAX_MS = 5 * 60 * 1000;
const isRateLimited = e => /429|rate limit/i.test(String(e?.message || ''));
// Lỗi 429 là do API game giới hạn số request, không phải lỗi dữ liệu: ghi dễ hiểu, kèm giờ tự thử lại
const rateLimitMessage = until => {
  const hhmm = new Date(until + Number(process.env.FLIP_TZ_OFFSET_MINUTES ?? 420) * 60000).toISOString().slice(11, 16);
  return `API game đang giới hạn số lần gọi (429), tự thử lại lúc ${hhmm}. Dữ liệu vẫn là lần đồng bộ gần nhất`;
};
// "fetch failed" = không kết nối được tới server game (mạng Render chập chờn, timeout), KHÔNG phải bị chặn 429
const netErrorCode = e => e?.cause?.code || e?.cause?.cause?.code || (/fetch failed/i.test(String(e?.message || '')) ? 'NETWORK' : null);
const networkErrorMessage = (code, at) => {
  const hhmm = new Date(at + Number(process.env.FLIP_TZ_OFFSET_MINUTES ?? 420) * 60000).toISOString().slice(11, 16);
  return `Mất kết nối tới API game (${code}), không phải bị chặn. Tự thử lại lúc ${hhmm}`;
};
// Lỗ hổng chờ quá lâu mà chưa có ảnh chụp farm sau đó thì thôi, chỉ cảnh báo
const GAP_RESOLVE_TIMEOUT_MS = 15 * 60 * 1000;
const FOCUS_WINDOW_MS = 10 * 60 * 1000;
const REF_PRICE_WINDOW_MS = 30 * 60 * 1000;
const SNAPSHOT_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

const reportCache = new Map();
const farmStates = new Map(); // farmId -> trạng thái nhịp lấy giao dịch
const timers = new Map();
let started = false;
// Trạng thái lấy giao dịch riêng từng farm (người dùng chỉ thấy farm của mình)
const statusByFarm = new Map();

const col = {
  state: () => getCollection('flip_state'),
  snapshots: () => getCollection('flip_snapshots'),
  gaps: () => getCollection('flip_gaps'),
  adjustments: () => getCollection('flip_adjustments'),
  sessions: () => getCollection('flip_sessions')
};

function parseFarmIds(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,;]+/)
    .map(id => id.trim())
    .filter(id => /^\d+$/.test(id));
}

/**
 * Farm của chủ (FLIP_FARM_IDS, dùng API key của server). Cần có FLIP_OWNER_KEY.
 */
function getOwnerFarmIds() {
  return process.env.FLIP_OWNER_KEY ? parseFarmIds(process.env.FLIP_FARM_IDS) : [];
}

/**
 * Mọi farm đang được lấy giao dịch: farm của chủ + farm người dùng tự đăng ký (key còn dùng được)
 */
function getFlipFarmIds() {
  return [...new Set([...getOwnerFarmIds(), ...flipUsers.activeFarmIds()])];
}

/**
 * Tính năng FLIP bật khi FLIP_ENABLED=true (chủ cần thêm FLIP_OWNER_KEY + FLIP_FARM_IDS,
 * người dùng tự đăng ký cần FLIP_KEY_SECRET để mã hoá key)
 */
function isFlipEnabled() {
  return process.env.FLIP_ENABLED === 'true';
}

/**
 * Bộ gọi API cho một farm: farm của chủ dùng key + hàng đợi + cache của server,
 * farm người dùng dùng key và hàng đợi riêng của họ
 */
function getClient(farmId) {
  const id = String(farmId);
  if (!getOwnerFarmIds().includes(id)) {
    const client = flipUsers.getClient(id);
    if (client) return client;
  }
  return {
    queue: sflCommunityQueue,
    fetchProfile() {
      // Bỏ cache 3 phút của marketplaceProfile để mỗi lượt thật sự lấy dữ liệu mới.
      // Xếp lên đầu hàng (trước các tác vụ nền như tải đấu giá cũ): lúc này không có người dùng nào đang chờ,
      // người dùng đến sau vẫn được chen lên trước
      farmCache.del(`market_profile_${id}`);
      // Không tự gọi lại sau 12s khi bị 429: vòng lấy giao dịch tự lùi lịch 30s → 5 phút
      return fetchMarketplaceProfile(id, true, { retryOn429: false });
    },
    getGameData: (priority = false) => getGameData(id, priority),
    getFetchedAt: () => getSyncInfo(id).fetchedAt
  };
}

function keysMatch(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Middleware: mã trong header x-flip-key là mã chủ (xem các farm FLIP_FARM_IDS) hoặc mã của người dùng
 * (chỉ xem farm của họ). Sai mã hoặc farm không thuộc quyền thì trả 404 như route không tồn tại.
 */
function requireFlipAccess(req, res, next) {
  const notFound = () => res.status(404).json({ success: false, error: 'NOT_FOUND' });
  if (!isFlipEnabled()) return notFound();
  const key = req.headers['x-flip-key'];
  let access = null;
  if (process.env.FLIP_OWNER_KEY && keysMatch(key, process.env.FLIP_OWNER_KEY)) {
    access = { role: 'owner', farms: getOwnerFarmIds() };
  } else {
    const farmId = flipUsers.findFarmByCode(key);
    if (farmId) access = { role: 'user', farms: [farmId] };
  }
  if (!access) return notFound();
  if (req.params.farmId && !access.farms.includes(String(req.params.farmId))) return notFound();
  req.flip = access;
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

/**
 * Giá chợ mới nhất trong DB (ảnh chụp 15 phút của jobs/marketCollector).
 * DB chưa có ảnh chụp nào (lần đầu chạy) thì mới gọi API.
 */
async function latestMarketPrices() {
  const snap = await marketRepo.latestAnySnapshot().catch(() => null);
  if (snap?.prices && Object.keys(snap.prices).length) {
    return { prices: snap.prices, flowerPrice: snap.flowerPrice || 0 };
  }
  return { prices: (await getMarketPrices())?.prices || {}, flowerPrice: 0 };
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

async function saveSnapshot(farmId, isTradeResource, client = getClient(farmId)) {
  const gameData = await client.getGameData(false);
  const fetchedAt = client.getFetchedAt();
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
    current = (await latestMarketPrices()).prices;
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
// Lệnh mua mới khớp trong khoảng này mà món đó chưa có phiên mở thì tự mở phiên (chốt vẫn bấm tay)
const AUTO_SESSION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Tự mở phiên gom hàng: thấy lệnh MUA tài nguyên mới khớp mà món đó chưa có phiên mở thì mở phiên,
 * mốc bắt đầu = lúc lệnh mua đầu tiên khớp. Lần đầu đồng bộ farm (chưa có lịch sử) thì bỏ qua để không
 * mở hàng loạt phiên cho các lệnh cũ. Tắt bằng FLIP_AUTO_SESSION=false.
 */
async function autoOpenSessions(farmId, newTrades, isTradeResource, hadHistory) {
  if (process.env.FLIP_AUTO_SESSION === 'false' || !hadHistory || !newTrades.length) return [];
  const since = Date.now() - AUTO_SESSION_WINDOW_MS;
  const firstBuy = new Map();
  for (const t of newTrades) {
    if (getTradeSide(t, farmId) !== 'buy' || !(t.fulfilledAt >= since)) continue;
    const item = resolveName(t);
    if (!item || !isTradeResource(item)) continue;
    firstBuy.set(item, Math.min(firstBuy.get(item) ?? Infinity, t.fulfilledAt));
  }
  const opened = [];
  for (const [item, at] of firstBuy) {
    const r = await openSession(farmId, { item, startedAt: at - 1000, note: 'Tự mở khi thấy lệnh mua', auto: true });
    if (r.session && !r.alreadyOpen) opened.push(item);
  }
  if (opened.length) console.log(`[Flip] Farm ${farmId}: tự mở phiên gom ${opened.join(', ')}`);
  return opened;
}

// Mọi chỗ cần giao dịch (vòng 1 phút, nút Đồng bộ, chốt phiên) dùng chung 1 lần gọi profile mỗi farm:
// gọi gần nhất < PROFILE_MIN_INTERVAL_MS thì dùng lại kết quả, đang gọi thì chờ chung, đang bị 429 thì không gọi
const PROFILE_MIN_INTERVAL_MS = 70 * 1000;
const profileCalls = { total: 0, since: Date.now() };

async function fetchProfileShared(farmId, client) {
  const state = getFarmState(farmId);
  const now = Date.now();
  if (state.rateLimitedUntil > now) {
    const e = new Error(`SFL API lỗi 429: đang chờ hết giới hạn tới ${new Date(state.rateLimitedUntil).toISOString()}`);
    e.rateLimited = true;
    throw e;
  }
  if (state.profileInflight) return state.profileInflight;
  // Tính từ lúc BẮT ĐẦU lần gọi trước (kể cả lần lỗi), không gọi lại sớm hơn PROFILE_MIN_INTERVAL_MS
  if (state.profileCallAt && now - state.profileCallAt < PROFILE_MIN_INTERVAL_MS) {
    if (state.profileData) return state.profileData;
    const e = new Error(`SFL API lỗi 429: chưa đủ ${PROFILE_MIN_INTERVAL_MS / 1000}s từ lần gọi trước`);
    e.rateLimited = true;
    throw e;
  }
  state.profileCallAt = now;
  profileCalls.total++;
  state.profileInflight = client.fetchProfile()
    .then(data => {
      state.profileAt = Date.now();
      state.profileData = data;
      return data;
    })
    .catch(e => {
      if (isRateLimited(e)) state.rateLimitedUntil = Math.max(state.rateLimitedUntil || 0, Date.now() + RATE_LIMIT_BACKOFF_MS);
      throw e;
    })
    .finally(() => { state.profileInflight = null; });
  return state.profileInflight;
}

/** Số lần thật sự gọi API profile kể từ lúc server chạy (xem ở /api/flip/status) */
function getProfileCallStats() {
  const minutes = Math.max(1, (Date.now() - profileCalls.since) / 60000);
  return { total: profileCalls.total, perMinute: Number((profileCalls.total / minutes).toFixed(2)), since: new Date(profileCalls.since).toISOString() };
}

async function syncFlipFarmTrades(farmId) {
  const client = getClient(farmId);
  // Có người dùng đang chờ trong hàng đợi API (của key này) thì nhường lượt
  if (client.queue.hasPriorityWaiting()) return { farmId, deferred: true };

  const collection = getMarketTradesCollection();
  const { calculateTradeTax, isTradeResource } = await getTaxModule();

  const data = await fetchProfileShared(farmId, client);
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
      // Ưu tiên giá FLOWER/USD trong ảnh chụp chợ đã lưu DB, chưa có thì mới hỏi API
      flowerUsdPrice = (await latestMarketPrices()).flowerPrice || (await fetchMarketplaceActivity())?.flowerUsdPrice || 0;
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
  const gameData = await client.getGameData(false);
  // Lưu trạng thái farm vào DB để báo cáo đọc từ DB, không gọi API khi người dùng mở trang
  await farmStateRepo.save(farmId, gameData, client.getFetchedAt()).catch(e => console.warn('[Flip] Không lưu được trạng thái farm:', e.message));
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

  await saveSnapshot(farmId, isTradeResource, client);
  const estimated = await resolvePendingGaps(farmId, gameData);
  const autoSessions = await autoOpenSessions(farmId, newTrades, isTradeResource, Boolean(lastBefore))
    .catch(e => { console.warn(`[Flip] Không tự mở được phiên farm ${farmId}:`, e.message); return []; });

  return {
    farmId,
    trades: trades.length,
    newTrades: newTrades.length,
    newestFulfilledAt: trades.length ? Math.max(...trades.map(t => t.fulfilledAt)) : null,
    gapDetected: !!gap,
    gapsEstimated: estimated,
    autoSessions
  };
}

function recordResult(result) {
  const key = String(result.farmId);
  const st = statusByFarm.get(key) || { lastRunAt: null, lastSuccessAt: null, lastError: null, lastResult: null };
  st.lastRunAt = new Date().toISOString();
  st.lastResult = result;
  if (result.error) {
    st.lastError = result.error;
  } else {
    st.lastError = null;
    st.lastSuccessAt = st.lastRunAt;
  }
  statusByFarm.set(key, st);
  clearReportCache(key);
}

function clearReportCache(farmId) {
  for (const k of reportCache.keys()) {
    if (JSON.parse(k)[0] === String(farmId)) reportCache.delete(k);
  }
}

function stopFarm(farmId) {
  clearTimeout(timers.get(String(farmId)));
  timers.delete(String(farmId));
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
      state.rateLimitedUntil = 0;
      if (state.rateLimitStreak) console.log(`[Flip] Farm ${farmId}: hết bị chặn 429, lấy giao dịch bình thường`);
      state.rateLimitStreak = 0;
      const before = state.mode;
      scheduler.applyPollResult(state, result, Date.now(), config);
      if (before !== state.mode) console.log(`[Flip] Farm ${farmId}: chuyển sang nhịp ${state.mode === 'fast' ? 'nhanh' : 'thường'}`);
      delay = scheduler.nextDelay(state, Date.now(), config);
    }
  } catch (e) {
    if (isRateLimited(e)) {
      state.rateLimitStreak = (state.rateLimitStreak || 0) + 1;
      delay = Math.min(RATE_LIMIT_BACKOFF_MS * 2 ** (state.rateLimitStreak - 1), RATE_LIMIT_BACKOFF_MAX_MS);
      state.rateLimitedUntil = Date.now() + delay;
      recordResult({ farmId, error: rateLimitMessage(state.rateLimitedUntil), rateLimited: true });
      // Chỉ ghi log lần đầu và mỗi khi tăng mức chờ, không spam
      if (delay < RATE_LIMIT_BACKOFF_MAX_MS || state.rateLimitStreak === 1) {
        console.warn(`[Flip] Farm ${farmId}: SFL chặn 429 (lần ${state.rateLimitStreak}), thử lại sau ${Math.round(delay / 1000)}s`);
      }
    } else {
      delay = scheduler.nextDelay(state, Date.now(), config);
      const code = netErrorCode(e);
      recordResult({ farmId, error: code ? networkErrorMessage(code, Date.now() + (delay || 0)) : e.message });
      console.error(`[Flip] Lỗi lấy giao dịch farm ${farmId}:`, e.message, code ? `(${code})` : '');
    }
    // Key của người dùng bị SFL từ chối: dừng farm đó, chờ họ nhập key mới
    if (e.invalidKey && flipUsers.isUserFarm(farmId)) {
      await flipUsers.markInvalid(farmId, e.message).catch(() => {});
      delay = null;
    }
  } finally {
    state.polling = false;
  }
  if (delay == null) stopFarm(farmId);
  else {
    // Mọi farm dùng chung 1 hàng đợi API: nhịp gom 10s không được nhanh hơn mức hàng đợi phục vụ nổi
    // (mỗi farm đang chạy 1 request/lượt), không thì request dồn lại và bị 429
    const floor = sflCommunityQueue.delayMs * Math.max(1, timers.size);
    scheduleFarm(farmId, Math.max(delay, floor));
  }
}

function scheduleFarm(farmId, delay) {
  clearTimeout(timers.get(String(farmId)));
  const state = getFarmState(farmId);
  state.nextPollAt = Date.now() + delay;
  timers.set(String(farmId), setTimeout(() => pollFarm(farmId), delay));
}

async function syncAllFlipFarms(farmIds = getFlipFarmIds()) {
  const results = [];
  for (const farmId of farmIds) {
    // Farm đang bị SFL chặn 429: không gọi thêm (bấm Đồng bộ lúc này chỉ làm bị chặn lâu hơn)
    const until = getFarmState(farmId).rateLimitedUntil || 0;
    if (until > Date.now()) {
      results.push({ farmId, skipped: true, rateLimited: true, error: rateLimitMessage(until) });
      continue;
    }
    try {
      const result = await syncFlipFarmTrades(farmId);
      if (!result.deferred) {
        recordResult(result);
        // Vừa đồng bộ tay xong: lượt tự động kế tiếp dời sang 1 phút sau, không gọi lại ngay
        if (started && timers.has(String(farmId)) && !getFarmState(farmId).polling) {
          scheduleFarm(farmId, scheduler.getSchedulerConfig().normalMs);
        }
      }
      results.push(result);
    } catch (e) {
      const msg = isRateLimited(e) ? rateLimitMessage(Date.now() + RATE_LIMIT_BACKOFF_MS) : e.message;
      if (isRateLimited(e)) getFarmState(farmId).rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
      recordResult({ farmId, error: msg, rateLimited: isRateLimited(e) });
      results.push({ farmId, error: msg });
    }
  }
  return { results };
}

/**
 * Bật vòng lấy giao dịch cho các farm trong FLIP_FARM_IDS: 1 phút một lần, đang gom hàng thì 10 giây
 */
async function startFlipSync() {
  if (!isFlipEnabled() || started) return started;
  started = true;
  try {
    await flipUsers.loadUsers();
  } catch (e) {
    console.error('[Flip] Không nạp được người dùng tự đăng ký:', e.message);
  }
  const config = scheduler.getSchedulerConfig();
  getFlipFarmIds().forEach((farmId, i) => scheduleFarm(farmId, 2000 + i * 1000));
  // Mỗi 30 phút in số lần thật sự gọi API profile, để soi xem có chỗ nào gọi dày bất thường
  let lastTotal = 0;
  setInterval(() => {
    const n = profileCalls.total - lastTotal;
    lastTotal = profileCalls.total;
    console.log(`[Flip] 30 phút qua gọi API profile ${n} lần (${(n / 30).toFixed(2)} lần/phút) cho ${getFlipFarmIds().length} farm`);
  }, 30 * 60 * 1000).unref();
  console.log(`[Flip] Lấy giao dịch cho ${getFlipFarmIds().length} farm: ${config.normalMs / 1000}s/lượt${config.fastEnabled ? `, gom hàng ${config.fastMs / 1000}s` : ''}`);
  return started;
}

// ---------- Người dùng tự đăng ký ----------

async function registerUser(body) {
  await flipUsers.loadUsers();
  const result = await flipUsers.register(body, {
    reservedFarmIds: getOwnerFarmIds(),
    maxUsers: Number(process.env.FLIP_MAX_USERS) || 100
  });
  if (result.code && started) scheduleFarm(result.farmId, 1000);
  return result;
}

async function updateUserKey(farmId, apiKey) {
  const result = await flipUsers.updateKey(farmId, apiKey);
  if (result.ok && started) scheduleFarm(farmId, 1000);
  return result;
}

async function unregisterUser(farmId) {
  const result = await flipUsers.unregister(farmId);
  if (result.ok) {
    stopFarm(farmId);
    farmStates.delete(String(farmId));
    statusByFarm.delete(String(farmId));
    clearReportCache(farmId);
  }
  return result;
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
  state.auto = false;
  state.mode = 'normal';
  if (started) scheduleFarm(farmId, scheduler.getSchedulerConfig().normalMs);
  return getFarmSchedule(farmId);
}

function getFarmSchedule(farmId) {
  const s = getFarmState(farmId);
  const now = Date.now();
  return {
    fastEnabled: scheduler.getSchedulerConfig().fastEnabled,
    mode: s.manualUntil > now ? 'fast' : s.mode,
    manualUntil: s.manualUntil > now ? s.manualUntil : null,
    // true = server tự bật vì thấy đang có lệnh khớp liên tục (không phải người dùng bấm nút)
    auto: s.manualUntil > now && Boolean(s.auto),
    lastPollAt: s.lastPollAt,
    nextPollAt: s.nextPollAt || null,
    lastNewTradeAt: s.lastNewTradeAt
  };
}

function getFarmSyncStatus(farmId) {
  return statusByFarm.get(String(farmId)) || { lastRunAt: null, lastSuccessAt: null, lastError: null, lastResult: null };
}

/**
 * Trạng thái cho người đang xem (chỉ các farm họ có quyền)
 */
function getFlipStatus(access = { role: 'owner', farms: getOwnerFarmIds() }) {
  return {
    role: access.role,
    running: started,
    scheduled: started,
    farms: access.farms,
    schedule: Object.fromEntries(access.farms.map(id => [id, getFarmSchedule(id)])),
    status: Object.fromEntries(access.farms.map(id => [id, getFarmSyncStatus(id)])),
    account: access.role === 'user' ? flipUsers.publicInfo(access.farms[0]) : null,
    profileCalls: access.role === 'owner' ? getProfileCallStats() : undefined
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
    const gameData = await getClient(farmId).getGameData(false);
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

// ---------- Phiên mua (theo từng vật phẩm) ----------

// Các cột theo vật phẩm lưu lại khi chốt phiên
const SESSION_RESOURCE_FIELDS = [
  'boughtQty', 'boughtCost', 'avgBuyPrice', 'soldQty', 'soldGross', 'soldAfterTax', 'avgSellPrice',
  'taxPaid', 'matchedQty', 'matchedCost', 'realizedProfit', 'realizedUsd', 'roi', 'wins', 'losses',
  'nonFlipQty', 'nonFlipAfterTax', 'avgHoldDays', 'lotsUsed'
];

function sessionView(doc) {
  return {
    id: String(doc._id),
    item: doc.item,
    status: doc.status,
    startedAt: doc.startedAt,
    endedAt: doc.endedAt ?? null,
    note: doc.note || '',
    auto: Boolean(doc.auto),
    result: doc.result || null
  };
}

// Phiên chỉ mở cho Tài nguyên (Resource)
async function validateSessionItem(body) {
  const { isTradeResource } = await getTaxModule();
  const item = typeof body?.item === 'string' ? body.item.trim() : '';
  return item && isTradeResource(item) ? item : null;
}

/**
 * Mốc 00:00 hôm qua theo FLIP_TZ_OFFSET_MINUTES: mốc mặc định khi chốt một vật phẩm chưa mở phiên
 */
function startOfYesterday(now = Date.now()) {
  const tz = Number(process.env.FLIP_TZ_OFFSET_MINUTES ?? 420) * 60 * 1000;
  const DAY = 24 * 60 * 60 * 1000;
  return Math.floor((now + tz) / DAY) * DAY - DAY - tz;
}

async function getOpenSessions(farmId) {
  const { isTradeResource } = await getTaxModule();
  const docs = await col.sessions().find({ farmId: String(farmId), status: 'open' }).sort({ startedAt: 1 }).toArray();
  // Phiên của món không còn là tài nguyên giao dịch (vd Aged Cobia mở từ bản cũ): không thống kê, không chốt được
  // (closeSession chỉ nhận tài nguyên), chỉ hiện 1 dòng trống. Huỷ luôn cho sạch bảng
  const stale = docs.filter(d => !isTradeResource(d.item));
  if (stale.length) {
    await col.sessions().deleteMany({ _id: { $in: stale.map(d => d._id) } }).catch(() => {});
    reportCache.clear();
    console.log(`[Flip] Farm ${farmId}: huỷ phiên của món không phải tài nguyên: ${stale.map(d => d.item).join(', ')}`);
  }
  return docs.filter(d => isTradeResource(d.item));
}

/**
 * Mở phiên cho một vật phẩm: từ lúc này vật phẩm có mặt trong bảng "Phiên đang mở"
 * và các lệnh khớp sau mốc startedAt được thống kê. Mỗi vật phẩm chỉ có một phiên mở.
 */
async function openSession(farmId, body = {}) {
  const item = await validateSessionItem(body);
  if (!item) return { errors: ['item'] };
  const existing = await col.sessions().findOne({ farmId: String(farmId), item, status: 'open' });
  if (existing) return { alreadyOpen: true, session: sessionView(existing) };
  const startedAt = parseAt(body.startedAt) ?? Date.now();
  const doc = {
    farmId: String(farmId),
    item,
    status: 'open',
    startedAt,
    note: body.note ? String(body.note).slice(0, 200) : '',
    auto: Boolean(body.auto),
    createdAt: Date.now()
  };
  const { insertedId } = await col.sessions().insertOne(doc);
  reportCache.clear();
  return { session: sessionView({ ...doc, _id: insertedId }) };
}

/**
 * Chốt phiên của một vật phẩm: tính lại lệnh khớp từ lúc mở phiên đến giờ, lưu vào lịch sử.
 * Vật phẩm chưa mở phiên vẫn chốt được (để chốt phiên hôm trước): mốc bắt đầu lấy từ body.startedAt,
 * mặc định 00:00 hôm qua.
 */
async function closeSession(farmId, body = {}) {
  const item = await validateSessionItem(body);
  if (!item) return { errors: ['item'] };
  const open = await col.sessions().findOne({ farmId: String(farmId), item, status: 'open' });
  const startedAt = open ? open.startedAt : (parseAt(body.startedAt) ?? startOfYesterday());
  const endedAt = Date.now();
  if (!(startedAt < endedAt)) return { errors: ['startedAt'] };

  // Không gọi API game khi chốt: vòng lấy giao dịch 1 phút/lần đã ghi lệnh vào DB, chốt chỉ đọc DB.
  // Lệnh vừa khớp trong ~1 phút cuối có thể chưa vào; cần thì bấm Đồng bộ trước rồi mới chốt
  const report = await computeFlipReport(farmId, { category: 'all', item, from: startedAt, to: endedAt });
  const row = report.resources.find(r => r.item === item) || {};
  const result = Object.fromEntries(SESSION_RESOURCE_FIELDS.map(k => [k, row[k] ?? null]));

  const fields = { status: 'closed', endedAt, result };
  let doc;
  if (open) {
    await col.sessions().updateOne({ _id: open._id }, { $set: fields });
    doc = { ...open, ...fields };
  } else {
    doc = { farmId: String(farmId), item, startedAt, note: '', createdAt: endedAt, ...fields, openedOnClose: true };
    const { insertedId } = await col.sessions().insertOne(doc);
    doc._id = insertedId;
  }
  reportCache.clear();
  return { session: sessionView(doc) };
}

async function listSessions(farmId, limit = 200) {
  const docs = await col.sessions().find({ farmId: String(farmId) }).sort({ startedAt: -1 }).limit(limit).toArray();
  return docs.map(sessionView);
}

async function deleteSession(farmId, id) {
  const _id = toObjectId(id);
  if (!_id) return { notFound: true };
  // Xoá phiên đang mở = huỷ phiên; xoá phiên đã chốt = bỏ khỏi lịch sử
  const { deletedCount } = await col.sessions().deleteOne({ _id, farmId: String(farmId) });
  reportCache.clear();
  return deletedCount ? { deleted: true } : { notFound: true };
}

/**
 * Lệnh MUA thật của farm cho 1 món trong khoảng [from, to] (để đối chiếu với đề xuất)
 * @returns {Promise<Array<{ at:number, unitPrice:number, qty:number }>>}
 */
async function findBuys(farmId, item, from, to) {
  const trades = await getMarketTradesCollection()
    .find({ ...farmTradesQuery(farmId), fulfilledAt: { $gte: from, $lte: to } })
    .toArray();
  return trades
    .filter(t => getTradeSide(t, farmId) === 'buy' && resolveName(t) === item && Number(t.quantity) > 0)
    .map(t => ({ at: t.fulfilledAt, unitPrice: (Number(t.sfl) || 0) / Number(t.quantity), qty: Number(t.quantity) }));
}

// ---------- Báo cáo ----------

/**
 * Gom lô đang giữ theo vật phẩm: số lượng, vốn và thời điểm mua của lô cũ nhất còn giữ
 */
function summarizeHeld(openLots) {
  const byItem = new Map();
  for (const lot of openLots) {
    const h = byItem.get(lot.item) || { item: lot.item, qty: 0, cost: 0, oldestBuyAt: lot.buyTime };
    h.qty += lot.qty;
    h.cost += lot.cost;
    h.oldestBuyAt = Math.min(h.oldestBuyAt, lot.buyTime);
    byItem.set(lot.item, h);
  }
  return [...byItem.values()].sort((a, b) => b.cost - a.cost);
}

function emptyResourceRow(item) {
  return {
    item, boughtQty: 0, boughtCost: 0, soldQty: 0, soldGross: 0, soldAfterTax: 0, taxPaid: 0, matchedQty: 0,
    matchedCost: 0, realizedProfit: 0, realizedUsd: 0, wins: 0, losses: 0, nonFlipQty: 0, nonFlipAfterTax: 0,
    usedQty: 0, usedCost: 0, openQty: 0, openCost: 0, marketPrice: null, openMarketValue: null, unrealizedProfit: null,
    avgBuyPrice: null, avgSellPrice: null, roi: null, avgHoldDays: null, lotsUsed: 0
  };
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
 * @param {object} query { from, to, category: 'resource' | 'nft' | 'all', item,
 *   range: 'session' (chỉ các vật phẩm đang mở phiên, mỗi món tính từ lúc mở phiên của nó) }
 */
async function buildFlipReport(farmId, query = {}) {
  const category = ['resource', 'nft', 'all'].includes(query.category) ? query.category : 'resource';
  // Excel làm mới nhiều bảng cùng lúc: dùng chung một lần tính trong vài giây
  const cacheKey = JSON.stringify([String(farmId), category, query.range ?? null, query.item ?? null, query.from ?? null, query.to ?? null]);
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

  const [trades, adjustments, gaps, openSessions] = await Promise.all([
    getMarketTradesCollection().find(farmTradesQuery(farmId)).toArray(),
    col.adjustments().find({ farmId: String(farmId) }).sort({ at: -1 }).toArray(),
    col.gaps().find({ farmId: String(farmId) }).sort({ detectedAt: -1 }).limit(100).toArray(),
    getOpenSessions(farmId)
  ]);

  // Xem theo phiên: chỉ các vật phẩm đang mở phiên, mỗi món tính lệnh khớp từ lúc mở phiên của nó
  const isSessionView = query.range === 'session';
  const sessionStart = new Map(openSessions.map(o => [o.item, o.startedAt]));
  const from = parseTime(query.from);
  const to = isSessionView ? null : parseTime(query.to, true);

  // Đọc trạng thái farm từ DB (job lấy giao dịch ghi vào). Chỉ khi DB chưa có (farm vừa đăng ký) mới gọi API 1 lần
  let gameData = (await farmStateRepo.get(farmId).catch(() => null))?.gameData || null;
  if (!gameData) {
    try {
      const client = getClient(farmId);
      gameData = await client.getGameData(true);
      await farmStateRepo.save(farmId, gameData, client.getFetchedAt()).catch(() => {});
    } catch (e) {
      // Key người dùng lỗi/đang bị giới hạn: dùng key server để vẫn xem được báo cáo
      console.warn(`[Flip] Không lấy được farm ${farmId} bằng key riêng:`, e.message);
      gameData = await getGameData(farmId, true);
    }
  }
  let marketPrices = {};
  try {
    marketPrices = (await latestMarketPrices()).prices;
  } catch (e) {
    console.warn('[Flip] Không đọc được giá thị trường trong DB:', e.message);
  }

  const allTrades = trades.concat(adjustments.map(a => adjustmentToTrade(a, farmId)));
  // Cột "Đang giữ" lấy số lượng thật trong kho đồ từ API (gồm cả đồ tự farm), không phải số lô FIFO còn lại
  const inventory = gameData?.inventory || {};
  const baseOptions = {
    farmId,
    resolveName,
    taxRateFor: (trade, name) => trade.taxRateAtTrade ?? calculateTradeTax(name, gameData),
    currentTaxRateFor: name => calculateTradeTax(name, gameData),
    tzOffsetMinutes: Number(process.env.FLIP_TZ_OFFSET_MINUTES ?? 420),
    marketPrices,
    // Chỉ so kho đồ khi đã lấy được farm, và chỉ với tài nguyên (NFT không nằm trong inventory)
    inventory: gameData?.inventory ? inventory : null,
    tracksInventory: isTradeResource
  };
  const report = computeFlip(allTrades, {
    ...baseOptions,
    includeItem: name => (query.item ? name === query.item : true)
      && (isSessionView ? sessionStart.has(name) && isTradeResource(name) : category === 'all' || (category === 'resource') === isTradeResource(name)),
    from,
    to,
    fromFor: isSessionView ? name => sessionStart.get(name) : null
  });

  // Hàng đang giữ (lô mua chưa bán, đã trừ phần đã dùng) của mọi vật phẩm, để mở phiên tính lùi từ lô cũ nhất.
  // Bảng phiên chỉ có các món đang mở phiên nên phải tính riêng trên toàn bộ lịch sử
  const heldLots = (isSessionView ? computeFlip(allTrades, baseOptions).openLots : report.openLots)
    .filter(lot => isTradeResource(lot.item));

  // Vật phẩm vừa mở phiên mà chưa có lệnh nào vẫn hiện một dòng trống trong bảng phiên
  if (isSessionView) {
    const have = new Set(report.resources.map(r => r.item));
    for (const o of openSessions) {
      if (!have.has(o.item)) report.resources.push(emptyResourceRow(o.item));
    }
  }
  for (const r of report.resources) {
    if (isSessionView) {
      const o = openSessions.find(x => x.item === r.item);
      r.sessionId = o ? String(o._id) : null;
      r.sessionStartedAt = o ? o.startedAt : null;
      r.sessionAuto = o ? Boolean(o.auto) : false;
    }
    r.inventoryQty = Number(inventory[r.item]) || 0;
    // Giá hiện tại trên chợ (giá treo bán rẻ nhất) và % chênh so với giá mua trung bình
    const price = marketPrices[r.item];
    r.currentPrice = price > 0 ? price : null;
    r.priceChange = r.currentPrice && r.avgBuyPrice > 0 ? r.currentPrice / r.avgBuyPrice - 1 : null;
  }

  const openGaps = gaps.filter(g => g.status !== 'resolved');
  return {
    farmId: String(farmId),
    category,
    range: isSessionView ? 'session' : null,
    openSessions: openSessions.map(sessionView),
    held: summarizeHeld(heldLots),
    generatedAt: new Date().toISOString(),
    tradeCount: trades.length,
    sync: getFarmSyncStatus(farmId),
    schedule: getFarmSchedule(farmId),
    account: flipUsers.publicInfo(farmId),
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
  fetchProfileShared,
  getProfileCallStats,
  isFlipEnabled,
  requireFlipAccess,
  getFlipFarmIds,
  getOwnerFarmIds,
  registerUser,
  updateUserKey,
  unregisterUser,
  registrationEnabled: flipUsers.registrationEnabled,
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
  openSession,
  closeSession,
  findBuys,
  autoOpenSessions,
  listSessions,
  deleteSession,
  startOfYesterday,
  validateAdjustment,
  adjustmentToTrade,
  detectGap,
  parseTime,
  keysMatch
};
