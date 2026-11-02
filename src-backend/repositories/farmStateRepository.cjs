/**
 * Tầng DB: trạng thái farm (gameData) mới nhất của người dùng FLIP.
 * Job lấy giao dịch ghi vào đây; báo cáo FLIP chỉ đọc từ đây, không gọi API khi người dùng mở trang.
 */
const { getCollection } = require('../config/db.cjs');

const col = () => getCollection('flip_farm_state');

async function save(farmId, gameData, fetchedAt) {
  if (!gameData) return;
  await col().updateOne(
    { _id: String(farmId) },
    { $set: { gameData, fetchedAt: fetchedAt ? Date.parse(fetchedAt) || Date.now() : Date.now(), savedAt: Date.now() } },
    { upsert: true }
  );
}

function get(farmId) {
  return col().findOne({ _id: String(farmId) });
}

module.exports = { save, get };
