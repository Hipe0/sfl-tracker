/**
 * Tầng DB cho dữ liệu chợ. Người dùng chỉ đọc từ đây; API chỉ được gọi ở jobs/marketCollector.
 *
 * Collections:
 * - market_prices   ảnh chụp chợ 15 phút/lần (giữ tên cũ, thêm trường mới; prices = floor)
 * - market_daily    báo cáo theo ngày từng tài nguyên (_id = "YYYY-MM-DD|Tên")
 * - market_supply   active supply + holders theo ngày từ nightly dump (_id = "YYYY-MM-DD|Tên")
 * - market_meta     trạng thái các job thu thập
 */
const { getCollection, getMarketPricesCollection } = require('../config/db.cjs');

const SNAPSHOT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const snapshots = () => getMarketPricesCollection() || getCollection('market_prices');
const daily = () => getCollection('market_daily');
const supply = () => getCollection('market_supply');
const meta = () => getCollection('market_meta');

let indexesReady = null;
function ensureIndexes() {
  if (!indexesReady) {
    indexesReady = Promise.all([
      snapshots().createIndex({ timestamp: -1 }),
      daily().createIndex({ item: 1, date: 1 }),
      daily().createIndex({ date: 1 }),
      supply().createIndex({ item: 1, date: 1 }),
      supply().createIndex({ date: 1 })
    ]).catch(err => {
      indexesReady = null;
      throw err;
    });
  }
  return indexesReady;
}

// ---------- Ảnh chụp 15 phút ----------

async function insertSnapshot(doc) {
  await snapshots().insertOne(doc);
  await snapshots().deleteMany({ timestamp: { $lt: Date.now() - SNAPSHOT_RETENTION_MS } });
}

/** Ảnh chụp mới nhất (đủ trường mới) */
function latestSnapshot() {
  return snapshots().find({ bestOffers: { $exists: true } }).sort({ timestamp: -1 }).limit(1).next();
}

/** Ảnh chụp mới nhất bất kể định dạng (dùng cho giá hiện tại) */
function latestAnySnapshot() {
  return snapshots().find({}).sort({ timestamp: -1 }).limit(1).next();
}

/** Ảnh chụp gần nhất trước hoặc tại thời điểm ts */
function snapshotAtOrBefore(ts) {
  return snapshots().find({ timestamp: { $lte: ts } }).sort({ timestamp: -1 }).limit(1).next();
}

/** Chuỗi điểm giá 1 tài nguyên từ ảnh chụp: [{ timestamp, price, volume, listings }] */
async function itemSnapshots(item, from) {
  const docs = await snapshots()
    .find({ timestamp: { $gte: from }, [`prices.${item}`]: { $exists: true } }, {
      projection: { timestamp: 1, [`prices.${item}`]: 1, [`volumes.${item}`]: 1, [`listings.${item}`]: 1 }
    })
    .sort({ timestamp: 1 })
    .toArray();
  return docs.map(d => ({
    timestamp: Number(d.timestamp instanceof Date ? d.timestamp.getTime() : d.timestamp),
    price: d.prices?.[item] ?? null,
    volume: d.volumes?.[item] ?? null,
    listings: d.listings?.[item] ?? null
  }));
}

// ---------- Theo ngày ----------

async function upsertDaily(rows) {
  if (!rows.length) return;
  await daily().bulkWrite(rows.map(r => ({
    updateOne: { filter: { _id: `${r.date}|${r.item}` }, update: { $set: r }, upsert: true }
  })), { ordered: false });
}

function itemDaily(item, fromDate) {
  return daily().find({ item, date: { $gte: fromDate } }, { projection: { _id: 0 } }).sort({ date: 1 }).toArray();
}

function allDaily(fromDate) {
  return daily().find({ date: { $gte: fromDate } }, { projection: { _id: 0 } }).sort({ date: 1 }).toArray();
}

/** Chốt 1 ngày: dòng ngày đã được cập nhật từ các ảnh chụp 15 phút, chỉ cần đánh dấu final */
async function finalizeDay(date) {
  const r = await daily().updateMany({ date }, { $set: { final: true } });
  return r.modifiedCount ?? r.matchedCount ?? 0;
}

/** Các ngày đã có báo cáo (để backfill phần còn thiếu) */
async function dailyDates() {
  return new Set(await daily().distinct('date'));
}

// ---------- Supply ----------

async function upsertSupply(rows) {
  if (!rows.length) return;
  await supply().bulkWrite(rows.map(r => ({
    updateOne: { filter: { _id: `${r.date}|${r.item}` }, update: { $set: r }, upsert: true }
  })), { ordered: false });
}

function itemSupply(item, fromDate) {
  return supply().find({ item, date: { $gte: fromDate } }, { projection: { _id: 0 } }).sort({ date: 1 }).toArray();
}

function allSupply(fromDate) {
  return supply().find({ date: { $gte: fromDate } }, { projection: { _id: 0 } }).sort({ date: 1 }).toArray();
}

async function supplyDates() {
  return new Set(await supply().distinct('date'));
}

// ---------- Trạng thái job ----------

async function getMeta(id) {
  return (await meta().findOne({ _id: id })) || { _id: id };
}

async function setMeta(id, fields) {
  await meta().updateOne({ _id: id }, { $set: fields }, { upsert: true });
}

module.exports = {
  ensureIndexes,
  insertSnapshot,
  latestSnapshot,
  latestAnySnapshot,
  snapshotAtOrBefore,
  itemSnapshots,
  upsertDaily,
  finalizeDay,
  itemDaily,
  allDaily,
  dailyDates,
  upsertSupply,
  itemSupply,
  allSupply,
  supplyDates,
  getMeta,
  setMeta
};
