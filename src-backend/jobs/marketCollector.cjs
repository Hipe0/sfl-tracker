/**
 * Job thu thập dữ liệu chợ: GỌI API rồi GHI DB. Người dùng không bao giờ chờ API ở đây,
 * họ chỉ đọc DB qua services/marketService.
 *
 * API game CHỈ được gọi 15 phút/lần để lấy giá (cộng với giao dịch FLIP ở flipService). Mọi thứ khác lấy từ DB:
 * - 15 phút/lần: ảnh chụp chợ (floor, offer cao nhất, giá khớp gần nhất, volume luỹ kế, số listing) + cập nhật dòng ngày hôm nay
 * - 00:15 UTC: chốt ngày hôm qua TỪ DB (dòng ngày đã được các ảnh chụp cập nhật, không gọi API)
 * - Lấp lịch sử theo ngày bằng marketplaceActivity&date= chỉ chạy tay: `npm run market:backfill`
 *   (hoặc MARKET_BACKFILL_AUTO=true để tự chạy khi khởi động + mỗi giờ như bản trước)
 * - 22:40 UTC: đếm active supply + holders từ nightly dump trên CDN, không phải API game, không tính rate limit
 *   (MARKET_DUMP_ENABLED=false để tắt, file ~800 MB/ngày)
 */
const cron = require('node-cron');
const client = require('../clients/sflCommunityClient.cjs');
const repo = require('../repositories/marketRepository.cjs');
const { getTaxModule, getIdMap } = require('../utils/sharedModules.cjs');
const { sflCommunityQueue } = require('../utils/apiQueue.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const MANUAL_REFRESH_MIN_MS = 60 * 1000;
const SNAPSHOT_EVERY_MS = 15 * 60 * 1000;
// Rate limit SFL tính theo IP: key của server và key của người dùng FLIP dùng chung 1 IP.
// Lấp lịch sử giãn thêm giữa các ngày để tổng số request không vượt ngưỡng.
const BACKFILL_GAP_MS = Number(process.env.MARKET_BACKFILL_GAP_MS) || 6000;
// Lỗi tạm thời (429 bị giới hạn, 5xx server SFL lỗi, mất mạng): chờ rồi thử lại
const RETRY_DELAYS_MS = [15000, 45000, 90000];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const utcDate = ts => new Date(ts).toISOString().slice(0, 10);

let started = false;
let snapshotRunning = null;
let backfillRunning = null;
let dumpRunning = null;
const status = { lastSnapshotAt: null, lastError: null, backfill: null, dump: null };

/** key "collectibles-601" -> tên tài nguyên, chỉ tài nguyên (bỏ NFT, wearables...) */
async function resourceKeys() {
  const { isTradeResource } = await getTaxModule();
  const map = {};
  for (const [key, name] of Object.entries(getIdMap())) {
    if (key.startsWith('collectibles-') && isTradeResource(name)) map[key] = name;
  }
  return map;
}

function dailyRows(date, items, keys, final) {
  const rows = [];
  for (const [key, name] of Object.entries(keys)) {
    const d = items[key];
    if (!d) continue;
    // Đã kiểm chứng 2026-11-02: volume/trades/quantity/low/high trong báo cáo là số LUỸ KẾ từ trước tới giờ
    // (doc ghi là theo ngày nhưng không phải). Lưu nguyên số luỹ kế, lúc đọc lấy hiệu 2 ngày liền nhau.
    rows.push({
      date,
      item: name,
      close: d.latestSale || d.floor || null,
      floor: d.floor ?? null,
      bestOffer: d.bestOffer ?? null,
      cumVolume: d.volume || 0,
      cumTrades: d.trades || 0,
      cumQuantity: d.quantity || 0,
      listingCount: d.listingCount ?? null,
      offerCount: d.offerCount ?? null,
      final
    });
  }
  return rows;
}

/** Chụp chợ 1 lần và ghi DB */
async function takeSnapshot({ priority = false } = {}) {
  if (snapshotRunning) return snapshotRunning;
  snapshotRunning = (async () => {
    try {
      const keys = await resourceKeys();
      const report = await client.getMarketplaceActivity(null, { priority });
      const doc = {
        timestamp: Date.now(),
        day: report.date,
        flowerPrice: report.flowerPrice,
        prices: {}, latestSales: {}, bestOffers: {}, volumes: {}, trades: {}, quantities: {}, listings: {}, offers: {}
      };
      for (const [key, name] of Object.entries(keys)) {
        const d = report.items[key];
        if (!d) continue;
        const price = d.floor > 0 ? d.floor : d.latestSale || 0;
        if (!(price > 0)) continue;
        doc.prices[name] = price;
        doc.latestSales[name] = d.latestSale ?? null;
        doc.bestOffers[name] = d.bestOffer ?? null;
        doc.volumes[name] = d.volume || 0;
        doc.trades[name] = d.trades || 0;
        doc.quantities[name] = d.quantity || 0;
        doc.listings[name] = d.listingCount || 0;
        doc.offers[name] = d.offerCount || 0;
      }
      if (!Object.keys(doc.prices).length) throw new Error('API trả về báo cáo chợ rỗng');
      await repo.insertSnapshot(doc);
      if (report.date) await repo.upsertDaily(dailyRows(report.date, report.items, keys, false));
      status.lastSnapshotAt = doc.timestamp;
      status.lastError = null;
      await repo.setMeta('collector', { lastSnapshotAt: doc.timestamp });
      return doc;
    } catch (e) {
      status.lastError = e.message;
      console.error('[Market] Lỗi chụp chợ:', e.message);
      throw e;
    } finally {
      snapshotRunning = null;
    }
  })();
  return snapshotRunning;
}

/** Nút đồng bộ: chỉ chụp lại nếu ảnh chụp gần nhất đã cũ hơn 1 phút */
async function refreshIfStale() {
  const latest = status.lastSnapshotAt || (await repo.getMeta('collector')).lastSnapshotAt || 0;
  if (Date.now() - latest < MANUAL_REFRESH_MIN_MS) return { refreshed: false, lastSnapshotAt: latest };
  const doc = await takeSnapshot({ priority: true });
  return { refreshed: true, lastSnapshotAt: doc.timestamp };
}

const isTransient = e => !e.status || e.status === 429 || e.status >= 500;

/** Lấy báo cáo đã chốt của 1 ngày và ghi DB, lỗi tạm thời thì thử lại. Trả về số tài nguyên có dữ liệu. */
async function fetchDay(date, keys) {
  for (let attempt = 0; ; attempt++) {
    try {
      const report = await client.getMarketplaceActivity(date);
      const rows = dailyRows(date, report.items, keys, true);
      await repo.upsertDaily(rows);
      return rows.length;
    } catch (e) {
      if (!isTransient(e) || attempt >= RETRY_DELAYS_MS.length) throw e;
      console.warn(`[Market] Ngày ${date}: ${e.message}, thử lại sau ${RETRY_DELAYS_MS[attempt] / 1000}s (lần ${attempt + 1}/${RETRY_DELAYS_MS.length})`);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/** Lấp các ngày còn thiếu, từ hôm qua lùi dần. Gặp ngày API không còn dữ liệu thì dừng. */
async function backfill(days = Number(process.env.MARKET_BACKFILL_DAYS) || 330) {
  if (backfillRunning) return backfillRunning;
  backfillRunning = (async () => {
    const keys = await resourceKeys();
    const have = await repo.dailyDates();
    const finalDays = new Set((await repo.allDaily(utcDate(Date.now() - days * DAY_MS)))
      .filter(r => r.final).map(r => r.date));
    // Mốc API hết dữ liệu (lần trước đã dò ra): không hỏi lùi quá mốc này nữa
    const prev = await repo.getMeta('backfill');
    const missing = [];
    for (let i = 1; i <= days; i++) {
      const date = utcDate(Date.now() - i * DAY_MS);
      if (prev.stoppedAt && date <= prev.stoppedAt) break;
      if (!finalDays.has(date)) missing.push(date);
    }
    status.backfill = { running: true, done: 0, total: missing.length, stoppedAt: prev.stoppedAt || null, failed: [] };
    if (missing.length) console.log(`[Market] Lấp ${missing.length} ngày giá còn thiếu`);
    const emptyRun = [];
    for (const date of missing) {
      // Có người dùng đang chờ API thì nhường
      while (sflCommunityQueue.hasPriorityWaiting()) await sleep(3000);
      try {
        const count = await fetchDay(date, keys);
        if (count === 0 && !have.has(date)) {
          // 3 ngày liền trả rỗng mới coi là API hết dữ liệu (1 lần rỗng có thể chỉ là trục trặc)
          emptyRun.push(date);
          if (emptyRun.length >= 3) {
            status.backfill.stoppedAt = emptyRun[0];
            console.log(`[Market] API không còn dữ liệu chợ từ ngày ${emptyRun[0]} trở về trước, dừng lấp lịch sử`);
            break;
          }
        } else {
          emptyRun.length = 0;
          status.backfill.done++;
        }
      } catch (e) {
        status.backfill.failed.push(date);
        console.warn(`[Market] Lỗi lấy dữ liệu ngày ${date} (sẽ thử lại ở lượt sau):`, e.message);
        if (e.status === 400 || e.status === 404) { status.backfill.stoppedAt = date; break; }
      }
      await sleep(BACKFILL_GAP_MS);
    }
    // Ngày rỗng lẻ (chưa đủ 3 ngày liền) thì để lượt sau thử lại
    if (!status.backfill.stoppedAt || status.backfill.stoppedAt !== emptyRun[0]) status.backfill.failed.push(...emptyRun);
    status.backfill.running = false;
    if (status.backfill.failed.length) {
      console.warn(`[Market] Còn ${status.backfill.failed.length} ngày lỗi: ${status.backfill.failed.join(', ')}. Tự lấy lại sau 1 giờ`);
    }
    await repo.setMeta('backfill', { finishedAt: Date.now(), stoppedAt: status.backfill.stoppedAt, failedDates: status.backfill.failed });
  })().finally(() => { backfillRunning = null; });
  return backfillRunning;
}

/**
 * Đếm active supply + holders từ nightly dump. Mặc định chỉ đếm file MỚI NHẤT nếu chưa đếm.
 * { fillMissing: true } (job đêm) đếm tiếp các ngày cũ còn thiếu trong 7 ngày CDN còn giữ, từng file một.
 * Khởi động lại server không tải lại file cũ (mỗi file ~800 MB).
 */
async function processNightlyDump({ fillMissing = false } = {}) {
  const first = await processOneDump(fillMissing);
  if (!fillMissing || !first || first.skipped) return first;
  for (;;) {
    const r = await processOneDump(true);
    if (!r || r.skipped) return first;
  }
}

async function processOneDump(anyMissing) {
  if (process.env.MARKET_DUMP_ENABLED === 'false') return null;
  if (dumpRunning) return dumpRunning;
  dumpRunning = (async () => {
    const { isTradeResource } = await getTaxModule();
    const manifest = await client.getNightlyDumpManifest();
    const done = await repo.supplyDates();
    const files = manifest
      .filter(f => /\/active\.jsonl\.gz$/.test(f.filename))
      .map(f => ({ ...f, date: f.filename.slice(0, 10) }))
      .sort((a, b) => b.date.localeCompare(a.date));
    // anyMissing: ngày mới nhất còn thiếu; không thì chỉ xét file mới nhất
    const file = anyMissing ? files.find(f => !done.has(f.date)) : files.slice(0, 1).find(f => !done.has(f.date));
    if (!file) return { skipped: true };

    status.dump = { running: true, date: file.date, farms: 0, startedAt: Date.now() };
    console.log(`[Market] Đang đếm supply từ ${file.filename} (${Math.round((file.size || 0) / 1e6)} MB)...`);
    const totals = new Map();
    await client.streamNightlyDump(file.filename, row => {
      if (row.isBlacklisted) return;
      status.dump.farms++;
      const inv = row.farm?.inventory || {};
      for (const [name, raw] of Object.entries(inv)) {
        if (!isTradeResource(name)) continue;
        const qty = Number(raw) || 0;
        if (qty <= 0) continue;
        const t = totals.get(name) || { supply: 0, holders: 0 };
        t.supply += qty;
        t.holders++;
        totals.set(name, t);
      }
    });
    const rows = [...totals.entries()].map(([item, t]) => ({ date: file.date, item, supply: t.supply, holders: t.holders, farms: status.dump.farms }));
    await repo.upsertSupply(rows);
    await repo.setMeta('dump', { lastDate: file.date, farms: status.dump.farms, finishedAt: Date.now() });
    console.log(`[Market] Xong supply ngày ${file.date}: ${status.dump.farms} farm, ${rows.length} tài nguyên`);
    status.dump = { running: false, date: file.date, farms: status.dump.farms, finishedAt: Date.now() };
    return { date: file.date, items: rows.length };
  })().catch(e => {
    status.dump = { running: false, error: e.message };
    console.error('[Market] Lỗi đếm nightly dump:', e.message);
    return null;
  }).finally(() => { dumpRunning = null; });
  return dumpRunning;
}

function getStatus() {
  return { ...status, started };
}

/** Bật các lịch thu thập. Gọi 1 lần khi server khởi động. */
async function startMarketCollector() {
  if (started) return;
  if (!process.env.SFL_API_KEY) {
    console.warn('[Market] Thiếu SFL_API_KEY: không thu thập dữ liệu chợ');
    return;
  }
  started = true;
  await repo.ensureIndexes().catch(e => console.warn('[Market] Không tạo được index:', e.message));
  cron.schedule('*/15 * * * *', () => takeSnapshot().catch(() => {}), { timezone: 'UTC' });
  cron.schedule('15 0 * * *', async () => {
    try {
      const n = await repo.finalizeDay(utcDate(Date.now() - DAY_MS));
      console.log(`[Market] Chốt ngày hôm qua từ DB: ${n} tài nguyên`);
    } catch (e) {
      console.warn('[Market] Lỗi chốt ngày hôm qua:', e.message);
    }
  }, { timezone: 'UTC' });
  cron.schedule('40 22 * * *', () => processNightlyDump({ fillMissing: true }), { timezone: 'UTC' });
  const autoBackfill = process.env.MARKET_BACKFILL_AUTO === 'true';
  if (autoBackfill) {
    cron.schedule('35 * * * *', () => backfill().catch(e => console.warn('[Market] Lỗi lấp lịch sử:', e.message)), { timezone: 'UTC' });
  }

  // Lần đầu: chụp ngay rồi đếm supply chạy nền
  setTimeout(async () => {
    // Restart liên tục (nodemon) không gọi API lại nếu ảnh chụp giá gần nhất còn trong 15 phút
    const last = (await repo.getMeta('collector').catch(() => ({}))).lastSnapshotAt || 0;
    if (Date.now() - last >= SNAPSHOT_EVERY_MS) await takeSnapshot().catch(() => {});
    else console.log(`[Market] Ảnh chụp giá còn mới (${Math.round((Date.now() - last) / 60000)} phút trước), không gọi API lúc khởi động`);
    if (autoBackfill) await backfill().catch(e => console.warn('[Market] Lỗi lấp lịch sử:', e.message));
    await processNightlyDump();
  }, 5000);
  console.log(`[Market] Gọi API game 15 phút/lần để lấy giá; ngày chốt từ DB; lấp lịch sử ${autoBackfill ? 'tự động' : 'chạy tay bằng npm run market:backfill'}`);
}

module.exports = { startMarketCollector, takeSnapshot, refreshIfStale, backfill, processNightlyDump, getStatus, dailyRows, resourceKeys };
