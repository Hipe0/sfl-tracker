/**
 * Tầng DB: trạng thái farm (gameData) mới nhất của người dùng FLIP.
 * Job lấy giao dịch ghi vào đây; báo cáo FLIP chỉ đọc từ đây, không gọi API khi người dùng mở trang.
 *
 * Băng thông: gameData nặng cỡ 100–300 KB. Trước đây job ghi nguyên cục lên MongoDB Atlas mỗi lượt
 * (60 giây, gom hàng 10 giây), Render tính đó là băng thông ra ngoài: ~200–300 MB/ngày cho 1 farm.
 * Giờ bản mới nhất giữ trong RAM (đọc lấy từ RAM trước), DB chỉ ghi lại tối đa FLIP_STATE_SAVE_MINUTES
 * phút một lần (mặc định 60) để server khởi động lại vẫn có dữ liệu.
 */
const { getCollection } = require('../config/db.cjs');

const col = () => getCollection('flip_farm_state');
const latest = new Map(); // farmId -> { _id, gameData, fetchedAt, savedAt }
const lastDbWrite = new Map(); // farmId -> thời điểm ghi DB gần nhất

const saveEveryMs = () => Math.max(0, Number(process.env.FLIP_STATE_SAVE_MINUTES ?? 60)) * 60 * 1000;

async function save(farmId, gameData, fetchedAt, { force = false } = {}) {
  if (!gameData) return;
  const id = String(farmId);
  const now = Date.now();
  const doc = { _id: id, gameData, fetchedAt: fetchedAt ? Date.parse(fetchedAt) || now : now, savedAt: now };
  latest.set(id, doc);
  if (!force && now - (lastDbWrite.get(id) || 0) < saveEveryMs()) return;
  lastDbWrite.set(id, now);
  try {
    await col().updateOne(
      { _id: id },
      { $set: { gameData: doc.gameData, fetchedAt: doc.fetchedAt, savedAt: doc.savedAt } },
      { upsert: true }
    );
  } catch (e) {
    lastDbWrite.delete(id); // lỗi thì lượt sau thử ghi lại
    throw e;
  }
}

async function get(farmId) {
  const id = String(farmId);
  if (latest.has(id)) return latest.get(id);
  const doc = await col().findOne({ _id: id });
  if (doc && !latest.has(id)) latest.set(id, doc);
  return doc;
}

/** Bỏ bản trong RAM khi người dùng huỷ đăng ký FLIP (RAM chỉ giữ 1 bản/farm, ghi đè chứ không cộng dồn) */
function forget(farmId) {
  latest.delete(String(farmId));
  lastDbWrite.delete(String(farmId));
}

module.exports = { save, get, forget };
