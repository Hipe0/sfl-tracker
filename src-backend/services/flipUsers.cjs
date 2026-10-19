/**
 * Người dùng FLIP tự đăng ký bằng farm ID + API key SFL của chính họ.
 * Mỗi key có hàng đợi riêng nên giới hạn request của người này không ảnh hưởng người khác hay app chính.
 * Key được mã hoá AES-256-GCM (FLIP_KEY_SECRET) trước khi lưu, không bao giờ trả về trình duyệt.
 */
const crypto = require('crypto');
const { getCollection } = require('../config/db.cjs');
const { APIQueue } = require('../utils/apiQueue.cjs');

const SFL_API = 'https://api.sunflower-land.com';
// Giới hạn chính thức khoảng 1 request / 5 giây cho mỗi key
const QUEUE_DELAY_MS = 5500;
// Kho đồ/số dư của farm người dùng: lấy lại tối đa mỗi chừng này (ảnh chụp để bù lệnh sót cần độ mới ~1 phút)
const GAME_DATA_TTL_MS = 55 * 1000;
const RATE_LIMIT_RETRY_MS = 12000;

const users = new Map(); // farmId -> entry (có apiKey đã giải mã, chỉ nằm trong bộ nhớ)
const byCodeHash = new Map(); // sha256(mã truy cập) -> farmId
let loaded = false;

const collection = () => getCollection('flip_users');

class ApiKeyError extends Error {
  constructor(status) {
    super(`API key bị SFL từ chối (mã ${status})`);
    this.invalidKey = true;
    this.status = status;
  }
}

function encryptionKey() {
  const secret = process.env.FLIP_KEY_SECRET;
  return secret ? crypto.createHash('sha256').update(secret).digest() : null;
}

function registrationEnabled() {
  return process.env.FLIP_ENABLED === 'true' && !!encryptionKey() && process.env.FLIP_PUBLIC_SIGNUP !== 'false';
}

function encrypt(text) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function decrypt(enc) {
  const key = encryptionKey();
  if (!key || !enc) return null;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]).toString('utf8');
}

const hashCode = code => crypto.createHash('sha256').update(String(code)).digest('hex');
const newCode = () => `flp_${crypto.randomBytes(18).toString('base64url')}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function makeEntry(doc, apiKey) {
  return {
    farmId: String(doc._id),
    apiKey,
    last4: doc.last4,
    codeHash: doc.codeHash,
    status: doc.status || 'active',
    lastError: doc.lastError || null,
    createdAt: doc.createdAt,
    queue: new APIQueue(1, QUEUE_DELAY_MS),
    cache: { gameData: null, fetchedAt: 0 }
  };
}

function remember(entry) {
  const old = users.get(entry.farmId);
  if (old) byCodeHash.delete(old.codeHash);
  users.set(entry.farmId, entry);
  byCodeHash.set(entry.codeHash, entry.farmId);
}

async function callApi(entry, url, priority) {
  const run = () => entry.queue.add(() => fetch(url, { headers: { 'x-api-key': entry.apiKey } }), priority);
  let res = await run();
  if (res.status === 429) {
    await sleep(RATE_LIMIT_RETRY_MS);
    res = await run();
  }
  if (res.status === 401 || res.status === 403) throw new ApiKeyError(res.status);
  if (!res.ok) throw new Error(`SFL API lỗi ${res.status}`);
  return res.json();
}

/**
 * Bộ gọi API cho farm của người dùng, cùng giao diện với bộ gọi của chủ (flipService dùng chung)
 */
function makeClient(entry) {
  return {
    queue: entry.queue,
    async fetchProfile() {
      const json = await callApi(entry, `${SFL_API}/community/data?type=marketplaceProfile&farmId=${entry.farmId}`, true);
      return json?.data || {};
    },
    async getGameData(priority = false) {
      if (entry.cache.gameData && Date.now() - entry.cache.fetchedAt < GAME_DATA_TTL_MS) return entry.cache.gameData;
      const json = await callApi(entry, `${SFL_API}/community/farms/${entry.farmId}`, priority);
      if (!json?.farm) throw new Error('API không trả dữ liệu farm');
      entry.cache = { gameData: json.farm, fetchedAt: Date.now() };
      return json.farm;
    },
    getFetchedAt() {
      return entry.cache.fetchedAt ? new Date(entry.cache.fetchedAt).toISOString() : null;
    }
  };
}

async function loadUsers() {
  if (loaded) return;
  loaded = true;
  const docs = await collection().find({}).toArray();
  for (const doc of docs) {
    let apiKey = null;
    try {
      apiKey = decrypt(doc.apiKeyEnc);
    } catch {
      apiKey = null;
    }
    const entry = makeEntry(doc, apiKey);
    if (!apiKey) {
      entry.status = 'invalid';
      entry.lastError = 'Không giải mã được API key (FLIP_KEY_SECRET đã đổi?), hãy nhập lại key';
    }
    remember(entry);
  }
  if (docs.length) console.log(`[Flip] Đã nạp ${docs.length} người dùng tự đăng ký`);
}

function activeFarmIds() {
  return [...users.values()].filter(u => u.status === 'active' && u.apiKey).map(u => u.farmId);
}

function isUserFarm(farmId) {
  return users.has(String(farmId));
}

function findFarmByCode(code) {
  if (typeof code !== 'string' || !code.startsWith('flp_')) return null;
  return byCodeHash.get(hashCode(code)) || null;
}

function getClient(farmId) {
  const entry = users.get(String(farmId));
  return entry && entry.apiKey ? makeClient(entry) : null;
}

function publicInfo(farmId) {
  const u = users.get(String(farmId));
  if (!u) return null;
  return { farmId: u.farmId, keyLast4: u.last4, status: u.status, lastError: u.lastError, createdAt: u.createdAt };
}

function validateInput(body) {
  const farmId = String(body?.farmId ?? '').trim();
  const apiKey = String(body?.apiKey ?? '').trim();
  const errors = [];
  if (!/^\d{1,25}$/.test(farmId)) errors.push('farmId');
  if (apiKey.length < 8 || apiKey.length > 256 || /\s/.test(apiKey)) errors.push('apiKey');
  return { farmId, apiKey, errors };
}

/**
 * Gọi thử API bằng key người dùng để chắc key dùng được
 */
async function testKey(farmId, apiKey) {
  const probe = makeEntry({ _id: farmId, last4: '', codeHash: '' }, apiKey);
  const json = await callApi(probe, `${SFL_API}/community/data?type=marketplaceProfile&farmId=${farmId}`, true);
  if (!json?.data) throw new Error('API không trả dữ liệu giao dịch của farm này');
}

async function saveEntry(farmId, apiKey, code, existing) {
  const now = Date.now();
  const doc = {
    _id: farmId,
    apiKeyEnc: encrypt(apiKey),
    last4: apiKey.slice(-4),
    codeHash: hashCode(code),
    status: 'active',
    lastError: null,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  await collection().replaceOne({ _id: farmId }, doc, { upsert: true });
  remember(makeEntry(doc, apiKey));
}

/**
 * Đăng ký (hoặc lấy lại mã) bằng farm ID + API key.
 * Farm đã có người đăng ký: phải dùng đúng key cũ, trừ khi key cũ đã bị SFL từ chối.
 * @returns {{ code?: string, farmId?: string, error?: string, status?: number }}
 */
async function register(body, { reservedFarmIds = [], maxUsers = 100 } = {}) {
  if (!registrationEnabled()) return { error: 'REGISTRATION_DISABLED', status: 503 };
  const { farmId, apiKey, errors } = validateInput(body);
  if (errors.length) return { error: 'INVALID', fields: errors, status: 400 };
  if (reservedFarmIds.includes(farmId)) return { error: 'OWNER_FARM', status: 409 };

  const existing = users.get(farmId);
  if (existing && existing.status === 'active' && existing.apiKey && existing.apiKey !== apiKey) {
    return { error: 'FARM_TAKEN', status: 409 };
  }
  if (!existing && users.size >= maxUsers) return { error: 'FULL', status: 503 };

  try {
    await testKey(farmId, apiKey);
  } catch (e) {
    return e.invalidKey ? { error: 'INVALID_KEY', status: 400 } : { error: 'SFL_UNAVAILABLE', message: e.message, status: 502 };
  }

  const code = newCode();
  await saveEntry(farmId, apiKey, code, existing);
  return { code, farmId };
}

async function updateKey(farmId, apiKeyInput) {
  const { apiKey, errors } = validateInput({ farmId, apiKey: apiKeyInput });
  if (errors.length) return { error: 'INVALID', fields: errors, status: 400 };
  const existing = users.get(String(farmId));
  if (!existing) return { error: 'NOT_FOUND', status: 404 };
  try {
    await testKey(String(farmId), apiKey);
  } catch (e) {
    return e.invalidKey ? { error: 'INVALID_KEY', status: 400 } : { error: 'SFL_UNAVAILABLE', message: e.message, status: 502 };
  }
  const now = Date.now();
  await collection().updateOne({ _id: String(farmId) }, {
    $set: { apiKeyEnc: encrypt(apiKey), last4: apiKey.slice(-4), status: 'active', lastError: null, updatedAt: now }
  });
  existing.apiKey = apiKey;
  existing.last4 = apiKey.slice(-4);
  existing.status = 'active';
  existing.lastError = null;
  existing.cache = { gameData: null, fetchedAt: 0 };
  return { ok: true };
}

async function markInvalid(farmId, message) {
  const entry = users.get(String(farmId));
  if (!entry) return;
  entry.status = 'invalid';
  entry.lastError = message;
  await collection().updateOne({ _id: String(farmId) }, { $set: { status: 'invalid', lastError: message, updatedAt: Date.now() } });
}

async function unregister(farmId) {
  const entry = users.get(String(farmId));
  if (!entry) return { error: 'NOT_FOUND', status: 404 };
  users.delete(String(farmId));
  byCodeHash.delete(entry.codeHash);
  await collection().deleteOne({ _id: String(farmId) });
  return { ok: true };
}

module.exports = {
  registrationEnabled,
  loadUsers,
  activeFarmIds,
  isUserFarm,
  findFarmByCode,
  getClient,
  publicInfo,
  register,
  updateKey,
  markInvalid,
  unregister,
  validateInput,
  encrypt,
  decrypt,
  hashCode
};
