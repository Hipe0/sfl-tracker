/**
 * Tầng DB: yêu cầu tài nguyên theo chapter (đua pet, nhiệm vụ tuần, chế bánh, ...).
 * Lưu lại để chapter sau dùng tiếp vì yêu cầu thường lặp lại theo tuần của chapter.
 *
 * Mỗi bản ghi: { source, chapter, chapterWeek, season, items: { Tên: số lượng }, note, useInScore, createdAt }
 */
const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/db.cjs');

const col = () => getCollection('demand_requirements');

function list(filter = {}) {
  return col().find(filter).sort({ chapterWeek: 1, createdAt: -1 }).toArray();
}

async function insert(doc) {
  const res = await col().insertOne({ ...doc, createdAt: Date.now() });
  return { ...doc, _id: res.insertedId };
}

async function update(id, fields) {
  if (!ObjectId.isValid(id)) return null;
  const res = await col().findOneAndUpdate({ _id: new ObjectId(id) }, { $set: { ...fields, updatedAt: Date.now() } }, { returnDocument: 'after' });
  return res?.value ?? res ?? null;
}

async function remove(id) {
  if (!ObjectId.isValid(id)) return false;
  const res = await col().deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount > 0;
}

module.exports = { list, insert, update, remove };
