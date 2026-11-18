/**
 * Đếm (ước lượng) số byte backend GỬI RA NGOÀI, để theo dõi hạn mức băng thông của Render (gói free 5 GB/tháng).
 *  - http:   response trả cho trình duyệt / widget / cron (đếm byte thật đã ghi ra socket, sau gzip, + ~350 B header)
 *  - mongo:  lệnh gửi lên MongoDB Atlas (kích thước BSON TRƯỚC khi nén zlib → là cận trên) + heartbeat của driver
 *  - fetch:  request gọi ra ngoài (API SFL, Telegram): URL + header ước lượng + body
 * Không đếm được: gói ACK TCP, bắt tay TLS. Coi số này là ước lượng, đối chiếu với Render → Metrics → Bandwidth.
 * Xem: GET /api/system/bandwidth. Cộng dồn theo tháng lưu vào DB (collection bandwidth_usage) mỗi giờ.
 */
const HEADER_BYTES = 350;
const MONGO_MSG_HEADER = 26;
const HEARTBEAT_BYTES = 350;
const FETCH_HEADER_BYTES = 450;

const startedAt = Date.now();
const total = { http: 0, mongo: 0, mongoHeartbeat: 0, fetch: 0 };
const counts = { http: 0, mongo: 0, mongoHeartbeat: 0, fetch: 0 };
const byRoute = new Map(); // "GET /api/market/widget" -> { bytes, n }
const byMongoCmd = new Map(); // "update flip_farm_state" -> { bytes, n }
let unflushed = { http: 0, mongo: 0, mongoHeartbeat: 0, fetch: 0 };

function add(kind, bytes, key, map) {
  total[kind] += bytes;
  counts[kind] += 1;
  unflushed[kind] += bytes;
  if (map && key) {
    const e = map.get(key) || { bytes: 0, n: 0 };
    e.bytes += bytes;
    e.n += 1;
    map.set(key, e);
  }
}

/** Middleware Express: đặt TRƯỚC middleware gzip để đếm byte sau nén */
function httpMeter(req, res, next) {
  let bytes = 0;
  const write = res.write;
  const end = res.end;
  const len = (chunk, enc) => (chunk == null ? 0 : Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), typeof enc === 'string' ? enc : 'utf8'));
  res.write = function (chunk, enc, cb) { bytes += len(chunk, enc); return write.call(this, chunk, enc, cb); };
  res.end = function (chunk, enc, cb) { if (typeof chunk !== 'function') bytes += len(chunk, enc); return end.call(this, chunk, enc, cb); };
  res.on('finish', () => {
    // Gom route có tham số (/api/market/items/Wheat → /api/market/items/:x) để bảng gọn
    const path = String(req.originalUrl || req.url || '').split('?')[0]
      .replace(/(\/items\/|\/history\/)[^/]+/, '$1:x')
      .replace(/\/(\d+|[0-9a-f]{24})(?=\/|$)/g, '/:id');
    const key = `${req.method} ${path}`;
    add('http', bytes + HEADER_BYTES, key, byRoute);
  });
  next();
}

/** Gắn vào MongoClient (cần monitorCommands: true) */
function attachMongo(client, BSON) {
  client.on('commandStarted', e => {
    let size = 0;
    try { size = BSON.calculateObjectSize(e.command); } catch { size = 0; }
    const coll = e.command?.[e.commandName];
    add('mongo', size + MONGO_MSG_HEADER, `${e.commandName}${typeof coll === 'string' ? ' ' + coll : ''}`, byMongoCmd);
  });
  client.on('serverHeartbeatStarted', () => add('mongoHeartbeat', HEARTBEAT_BYTES));
}

/** Bọc fetch toàn cục: đếm request gửi đi (phần trả về là băng thông VÀO, Render không tính) */
function wrapFetch() {
  if (!globalThis.fetch || globalThis.fetch.__metered) return;
  const orig = globalThis.fetch;
  const metered = function (input, init) {
    try {
      const url = typeof input === 'string' ? input : input?.url || String(input);
      const body = init?.body;
      const bodyLen = body == null ? 0 : typeof body === 'string' ? Buffer.byteLength(body) : body.byteLength || body.length || 0;
      let host = 'other';
      try { host = new URL(url).host; } catch { /* bỏ qua */ }
      add('fetch', url.length + FETCH_HEADER_BYTES + bodyLen, `fetch ${host}`, byRoute);
    } catch { /* đếm lỗi thì thôi, không chặn request */ }
    return orig.call(this, input, init);
  };
  metered.__metered = true;
  globalThis.fetch = metered;
}

const MB = b => Number((b / 1024 / 1024).toFixed(2));
const top = (map, n = 12) => [...map.entries()].sort((a, b) => b[1].bytes - a[1].bytes).slice(0, n)
  .map(([key, v]) => ({ key, mb: MB(v.bytes), n: v.n, avgBytes: Math.round(v.bytes / v.n) }));

function snapshot() {
  const hours = Math.max((Date.now() - startedAt) / 3600000, 1 / 60);
  const sum = total.http + total.mongo + total.mongoHeartbeat + total.fetch;
  const perDay = (sum / hours) * 24;
  return {
    since: new Date(startedAt).toISOString(),
    hours: Number(hours.toFixed(2)),
    totalMB: MB(sum),
    byKindMB: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, MB(v)])),
    counts,
    perDayMB: MB(perDay),
    projected30dGB: Number((perDay * 30 / 1024 ** 3).toFixed(2)),
    topHttpAndFetch: top(byRoute),
    topMongo: top(byMongoCmd),
    note: 'Ước lượng; mongo là cỡ TRƯỚC nén zlib (cận trên). Đối chiếu Render → Metrics → Bandwidth.'
  };
}

/** Mỗi giờ: in log + cộng dồn vào DB theo tháng (UTC), để restart không mất số */
function startReporting(getCollection) {
  const flush = async () => {
    const s = snapshot();
    console.log(`[Băng thông] từ ${s.since}: ${s.totalMB} MB (http ${s.byKindMB.http}, mongo ${s.byKindMB.mongo}, heartbeat ${s.byKindMB.mongoHeartbeat}, fetch ${s.byKindMB.fetch}) → ~${s.perDayMB} MB/ngày, ~${s.projected30dGB} GB/30 ngày`);
    if (s.hours >= 6 && s.projected30dGB > 3) console.warn(`[Băng thông] CẢNH BÁO: đang đi tới ~${s.projected30dGB} GB/30 ngày (hạn mức Render free 5 GB). Xem /api/system/bandwidth`);
    const delta = unflushed;
    unflushed = { http: 0, mongo: 0, mongoHeartbeat: 0, fetch: 0 };
    const col = getCollection && getCollection('bandwidth_usage');
    if (!col) return;
    const month = new Date().toISOString().slice(0, 7);
    await col.updateOne({ _id: month }, { $inc: delta, $set: { updatedAt: Date.now() } }, { upsert: true })
      .catch(e => console.warn('[Băng thông] Không lưu được:', e.message));
  };
  setInterval(() => { flush().catch(() => {}); }, 60 * 60 * 1000).unref();
}

async function monthUsage(getCollection) {
  const col = getCollection && getCollection('bandwidth_usage');
  if (!col) return null;
  const month = new Date().toISOString().slice(0, 7);
  const doc = await col.findOne({ _id: month }).catch(() => null);
  if (!doc) return { month, totalMB: 0 };
  const kinds = ['http', 'mongo', 'mongoHeartbeat', 'fetch'];
  const saved = kinds.reduce((a, k) => a + (doc[k] || 0), 0);
  const pending = kinds.reduce((a, k) => a + unflushed[k], 0);
  return { month, totalMB: MB(saved + pending), byKindMB: Object.fromEntries(kinds.map(k => [k, MB((doc[k] || 0) + unflushed[k])])) };
}

module.exports = { httpMeter, attachMongo, wrapFetch, snapshot, startReporting, monthUsage };
