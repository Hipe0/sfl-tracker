/**
 * Nén gzip cho response gửi bằng res.json / res.send (JSON, HTML) khi trình duyệt hỗ trợ.
 * Tự viết bằng zlib có sẵn của Node để khỏi thêm thư viện. JSON giá/nến/báo cáo nén được ~5–10 lần.
 * File tĩnh (ảnh, sendFile) không đi qua đây; ảnh vốn đã nén sẵn.
 */
const zlib = require('zlib');

const MIN_BYTES = 1024;

module.exports = function compressJson(req, res, next) {
  const accepts = String(req.headers['accept-encoding'] || '');
  if (!/\bgzip\b/.test(accepts) || req.method === 'HEAD') return next();
  const send = res.send.bind(res);
  res.send = function (body) {
    try {
      const type = String(res.get('Content-Type') || '');
      const isText = typeof body === 'string' || (Buffer.isBuffer(body) && /json|text|html|javascript/.test(type));
      if (!isText || res.get('Content-Encoding') || res.statusCode === 204 || res.statusCode === 304) return send(body);
      const raw = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
      if (raw.length < MIN_BYTES) return send(body);
      if (!type) res.type(typeof body === 'string' ? 'html' : 'bin');
      if (!/charset/i.test(String(res.get('Content-Type'))) && typeof body === 'string') res.set('Content-Type', `${res.get('Content-Type')}; charset=utf-8`);
      res.set('Content-Encoding', 'gzip');
      res.vary('Accept-Encoding');
      res.removeHeader('Content-Length');
      return send(zlib.gzipSync(raw, { level: 6 }));
    } catch (e) {
      return send(body);
    }
  };
  next();
};
