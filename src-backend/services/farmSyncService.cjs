const cron = require('node-cron');
const { getFarmsCollection, getHistoryCollection } = require('../config/db.cjs');
const { sflCommunityQueue } = require('../utils/apiQueue.cjs');
const { farmCache } = require('./sflApiService.cjs');

const GET_FARMS_URL = 'https://api.sunflower-land.com/community/getFarms';
// POST /community/getFarms nhận tối đa 100 farm id mỗi request
const BATCH_SIZE = 100;

class RateLimitError extends Error {}

let isRunning = false;
let cronTask = null;
const status = {
  lastRunAt: null,
  lastSuccessAt: null,
  lastDurationMs: null,
  lastError: null,
  tracked: 0,
  fetched: 0,
  changed: 0,
  missing: []
};

/**
 * Tách chuỗi "123, 456 789" thành mảng farm id dạng chuỗi
 */
function parseFarmIds(value) {
  if (!value) return [];
  return String(value)
    .split(/[\s,;]+/)
    .map(id => id.trim())
    .filter(id => /^\d+$/.test(id));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Danh sách farm cần đồng bộ: SYNC_FARM_IDS trong .env + các farm đã có trong collection history
 */
async function getTrackedFarmIds() {
  const ids = new Set(parseFarmIds(process.env.SYNC_FARM_IDS));
  if (process.env.SYNC_INCLUDE_HISTORY_FARMS !== 'false') {
    const historyCollection = getHistoryCollection();
    if (historyCollection) {
      const docs = await historyCollection.find({}, { projection: { _id: 1 } }).toArray();
      docs.forEach(doc => {
        const id = String(doc._id);
        if (/^\d+$/.test(id)) ids.add(id);
      });
    }
  }
  return [...ids];
}

/**
 * Gọi POST /community/getFarms cho tối đa 100 id.
 * Id nằm trong `skipped` được chia đôi và gọi lại (response bị giới hạn 5.5MB);
 * id lẻ vẫn bị skipped nghĩa là farm không tồn tại.
 */
async function fetchFarmsBatch(ids, { fetchImpl = fetch, queue = sflCommunityQueue } = {}) {
  const res = await queue.add(() => fetchImpl(GET_FARMS_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SFL_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ ids: ids.map(Number) })
  }));

  if (res.status === 429) throw new RateLimitError('SFL API rate limit (429)');
  if (!res.ok) throw new Error(`SFL API getFarms lỗi HTTP ${res.status}`);

  const data = await res.json();
  const farms = { ...(data.farms || {}) };
  const skipped = (data.skipped || []).map(String);
  const missing = [];

  if (skipped.length && ids.length > 1) {
    const half = Math.ceil(skipped.length / 2);
    for (const part of [skipped.slice(0, half), skipped.slice(half)]) {
      if (!part.length) continue;
      const retry = await fetchFarmsBatch(part, { fetchImpl, queue });
      Object.assign(farms, retry.farms);
      missing.push(...retry.missing);
    }
  } else {
    missing.push(...skipped);
  }

  return { farms, missing };
}

/**
 * Lưu farm vào collection `farms`. Chỉ ghi lại dữ liệu farm khi `updatedAt` thay đổi,
 * farm không đổi chỉ cập nhật thời điểm kiểm tra `syncedAt`.
 */
async function saveFarms(farms, collection, now = new Date()) {
  const ids = Object.keys(farms);
  if (!ids.length) return { changed: 0 };

  const existing = await collection
    .find({ _id: { $in: ids } }, { projection: { updatedAt: 1 } })
    .toArray();
  const knownUpdatedAt = new Map(existing.map(doc => [String(doc._id), doc.updatedAt]));

  let changed = 0;
  const ops = ids.map(id => {
    const farm = farms[id];
    const updatedAt = farm?.updatedAt || null;
    const isChanged = !knownUpdatedAt.has(id) || knownUpdatedAt.get(id) !== updatedAt;
    if (!isChanged) {
      return { updateOne: { filter: { _id: id }, update: { $set: { syncedAt: now } } } };
    }
    changed++;
    return {
      updateOne: {
        filter: { _id: id },
        update: { $set: { farm, updatedAt, syncedAt: now, changedAt: now } },
        upsert: true
      }
    };
  });

  await collection.bulkWrite(ops, { ordered: false });
  return { changed };
}

/**
 * Một lượt đồng bộ: lấy toàn bộ farm đang theo dõi theo lô 100 và lưu vào MongoDB
 */
async function syncTrackedFarms(options = {}) {
  if (isRunning) return { skipped: true, reason: 'already_running' };
  if (!process.env.SFL_API_KEY) return { skipped: true, reason: 'missing_api_key' };

  isRunning = true;
  const startedAt = Date.now();
  status.lastRunAt = new Date(startedAt);

  try {
    const collection = options.collection || getFarmsCollection();
    const ids = options.ids || await getTrackedFarmIds();
    status.tracked = ids.length;

    let fetched = 0;
    let changed = 0;
    const missing = [];

    for (const batch of chunk(ids, BATCH_SIZE)) {
      const result = await fetchFarmsBatch(batch, options);
      missing.push(...result.missing);
      fetched += Object.keys(result.farms).length;

      const saved = await saveFarms(result.farms, collection);
      changed += saved.changed;

      // Làm nóng cache để API /api/farm/:id dùng ngay dữ liệu mới, không phải gọi SFL thêm lần nữa
      for (const [id, farm] of Object.entries(result.farms)) {
        farmCache.set(`gameData_${id}`, farm);
      }
    }

    Object.assign(status, {
      lastSuccessAt: new Date(),
      lastError: null,
      fetched,
      changed,
      missing
    });
    return { tracked: ids.length, fetched, changed, missing };
  } catch (err) {
    status.lastError = err.message;
    throw err;
  } finally {
    status.lastDurationMs = Date.now() - startedAt;
    isRunning = false;
  }
}

/**
 * Bật cron chạy mỗi phút (tắt bằng FARM_SYNC_ENABLED=false)
 */
function startFarmSync() {
  if (process.env.FARM_SYNC_ENABLED === 'false') {
    console.log('[FarmSync] Tắt do FARM_SYNC_ENABLED=false');
    return null;
  }
  if (!process.env.SFL_API_KEY) {
    console.warn('[FarmSync] Chưa có SFL_API_KEY, không bật đồng bộ farm mỗi phút');
    return null;
  }
  if (cronTask) return cronTask;

  const schedule = process.env.FARM_SYNC_CRON || '* * * * *';
  const run = () => syncTrackedFarms()
    .then(result => {
      if (result.skipped) return;
      console.log(`[FarmSync] ${result.fetched}/${result.tracked} farm, ${result.changed} thay đổi` +
        (result.missing.length ? `, không tìm thấy: ${result.missing.join(', ')}` : ''));
    })
    .catch(err => {
      const tag = err instanceof RateLimitError ? 'Bị rate limit, đợi lượt sau' : 'Lỗi';
      console.error(`[FarmSync] ${tag}:`, err.message);
    });

  cronTask = cron.schedule(schedule, run);
  run();
  console.log(`[FarmSync] Đồng bộ farm theo lịch "${schedule}"`);
  return cronTask;
}

function getFarmSyncStatus() {
  return { ...status, running: isRunning, enabled: !!cronTask };
}

module.exports = {
  parseFarmIds,
  getTrackedFarmIds,
  fetchFarmsBatch,
  saveFarms,
  syncTrackedFarms,
  startFarmSync,
  getFarmSyncStatus,
  RateLimitError
};
