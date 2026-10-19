const express = require('express');
const router = express.Router();
const {
  requireFlipAccess,
  getFlipStatus,
  syncAllFlipFarms,
  buildFlipReport,
  startBurst,
  stopBurst,
  addAdjustment,
  updateAdjustment,
  deleteAdjustment,
  openSession,
  closeSession,
  listSessions,
  deleteSession,
  registerUser,
  updateUserKey,
  unregisterUser,
  registrationEnabled
} = require('../services/flipService.cjs');

// Các bảng lẻ để Excel (Power Query) đọc thẳng thành bảng
const TABLES = ['summary', 'resources', 'lots', 'daily', 'openLots', 'nonFlip', 'adjustments', 'gaps'];

const fail = (res, e) => {
  console.error('[Flip] Lỗi:', e);
  res.status(502).json({ success: false, error: e.message });
};

// ---------- Không cần mã: để app biết có cho đăng ký không, và để người dùng tự đăng ký ----------

router.get('/public', (req, res) => {
  res.json({ success: true, data: { registration: registrationEnabled() } });
});

// Chống spam đăng ký: mỗi IP tối đa REGISTER_LIMIT lần mỗi giờ (mỗi lần đăng ký gọi thử API SFL)
const REGISTER_LIMIT = 10;
const registerHits = new Map();
function registerRateLimited(ip) {
  const now = Date.now();
  const hits = (registerHits.get(ip) || []).filter(t => now - t < 60 * 60 * 1000);
  hits.push(now);
  registerHits.set(ip, hits);
  return hits.length > REGISTER_LIMIT;
}

router.post('/register', async (req, res) => {
  // Sau proxy của Render: IP thật nằm ở đầu x-forwarded-for
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
  if (registerRateLimited(ip)) return res.status(429).json({ success: false, error: 'TOO_MANY_ATTEMPTS' });
  try {
    const result = await registerUser(req.body || {});
    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error, fields: result.fields, message: result.message });
    }
    res.json({ success: true, data: { code: result.code, farmId: result.farmId } });
  } catch (e) {
    fail(res, e);
  }
});

// ---------- Từ đây cần mã (mã chủ hoặc mã của người dùng) ----------

router.use(requireFlipAccess);

router.get('/status', (req, res) => {
  res.json({ success: true, data: getFlipStatus(req.flip) });
});

router.post('/sync', async (req, res) => {
  try {
    res.json({ success: true, data: await syncAllFlipFarms(req.flip.farms) });
  } catch (e) {
    fail(res, e);
  }
});

// Người dùng tự đăng ký: đổi API key, huỷ đăng ký
router.put('/me/key', async (req, res) => {
  if (req.flip.role !== 'user') return res.status(404).json({ success: false, error: 'NOT_FOUND' });
  try {
    const result = await updateUserKey(req.flip.farms[0], req.body?.apiKey);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error, message: result.message });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.delete('/me', async (req, res) => {
  if (req.flip.role !== 'user') return res.status(404).json({ success: false, error: 'NOT_FOUND' });
  try {
    const result = await unregisterUser(req.flip.farms[0]);
    if (result.error) return res.status(result.status || 400).json({ success: false, error: result.error });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

// Nút "Đang gom hàng": lấy giao dịch 10 giây một lần trong vài phút
router.post('/:farmId/burst', requireFlipAccess, (req, res) => {
  res.json({ success: true, data: startBurst(req.params.farmId, req.body?.minutes) });
});

router.delete('/:farmId/burst', requireFlipAccess, (req, res) => {
  res.json({ success: true, data: stopBurst(req.params.farmId) });
});

// Lệnh bù (ước tính) và lệnh nhập tay. Đọc danh sách qua GET /:farmId/adjustments (bảng phẳng bên dưới)
router.post('/:farmId/adjustments', requireFlipAccess, async (req, res) => {
  try {
    const result = await addAdjustment(req.params.farmId, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    res.json({ success: true, data: result.adjustment });
  } catch (e) {
    fail(res, e);
  }
});

router.patch('/:farmId/adjustments/:id', requireFlipAccess, async (req, res) => {
  try {
    const result = await updateAdjustment(req.params.farmId, req.params.id, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    if (result.notFound) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: result.adjustment });
  } catch (e) {
    fail(res, e);
  }
});

router.delete('/:farmId/adjustments/:id', requireFlipAccess, async (req, res) => {
  try {
    const result = await deleteAdjustment(req.params.farmId, req.params.id);
    if (result.notFound) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

// Phiên mua theo từng vật phẩm ({ item, startedAt? }): mở phiên thì món đó vào bảng phiên và được thống kê
// từ lúc mở; chốt phiên thì lưu kết quả vào lịch sử. Xoá phiên đang mở = huỷ phiên.
// Khai báo trước GET /:farmId/:table để "sessions" không bị hiểu là tên bảng
router.get('/:farmId/sessions', requireFlipAccess, async (req, res) => {
  try {
    res.json({ success: true, data: await listSessions(req.params.farmId) });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/:farmId/sessions', requireFlipAccess, async (req, res) => {
  try {
    const result = await openSession(req.params.farmId, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    if (result.alreadyOpen) return res.status(409).json({ success: false, error: 'SESSION_OPEN', data: result.session });
    res.json({ success: true, data: result.session });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/:farmId/sessions/close', requireFlipAccess, async (req, res) => {
  try {
    const result = await closeSession(req.params.farmId, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    res.json({ success: true, data: result.session });
  } catch (e) {
    fail(res, e);
  }
});

router.delete('/:farmId/sessions/:id', requireFlipAccess, async (req, res) => {
  try {
    const result = await deleteSession(req.params.farmId, req.params.id);
    if (result.notFound) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/:farmId', requireFlipAccess, async (req, res) => {
  try {
    res.json({ success: true, data: await buildFlipReport(req.params.farmId, req.query) });
  } catch (e) {
    fail(res, e);
  }
});

// Trả về mảng phẳng (summary là mảng 1 dòng) cho Power Query
router.get('/:farmId/:table', requireFlipAccess, async (req, res) => {
  const { table } = req.params;
  if (!TABLES.includes(table)) {
    return res.status(404).json({ success: false, error: 'NOT_FOUND' });
  }
  try {
    const report = await buildFlipReport(req.params.farmId, req.query);
    if (table === 'summary') {
      return res.json([{ ...report.summary, ...report.warnings, generatedAt: report.generatedAt }]);
    }
    res.json(report[table]);
  } catch (e) {
    fail(res, e);
  }
});

module.exports = router;
