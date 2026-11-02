/**
 * Đề xuất Mua đã đưa ra (mỗi món 1 dòng mỗi ngày) và kết quả thật sau đó. Collection market_reco.
 */
const { getCollection } = require('../config/db.cjs');

const recos = () => getCollection('market_reco');

/** Ghi đề xuất của ngày; đã có (cùng ngày, cùng món) thì giữ bản đầu tiên */
async function insertIfMissing(rows) {
  if (!rows.length) return 0;
  const r = await recos().bulkWrite(rows.map(row => ({
    updateOne: { filter: { _id: `${row.date}|${row.item}` }, update: { $setOnInsert: row }, upsert: true }
  })), { ordered: false });
  return r.upsertedCount || 0;
}

/** Các đề xuất chưa chấm xong (pending/holding) */
function unresolved() {
  return recos().find({ $or: [{ 'eval.status': { $in: ['pending', 'holding'] } }, { eval: { $exists: false } }] }).toArray();
}

function recent(limit = 200) {
  return recos().find({}).sort({ createdAt: -1 }).limit(limit).toArray();
}

function setEval(id, fields) {
  return recos().updateOne({ _id: id }, { $set: fields });
}

module.exports = { insertIfMissing, unresolved, recent, setEval };
