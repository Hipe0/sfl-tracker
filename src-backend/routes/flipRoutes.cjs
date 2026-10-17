const express = require('express');
const router = express.Router();
const {
  requireFlipOwner,
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
  deleteSession
} = require('../services/flipService.cjs');

// Các bảng lẻ để Excel (Power Query) đọc thẳng thành bảng
const TABLES = ['summary', 'resources', 'lots', 'daily', 'openLots', 'nonFlip', 'adjustments', 'gaps'];

const fail = (res, e) => {
  console.error('[Flip] Lỗi:', e);
  res.status(502).json({ success: false, error: e.message });
};

router.use(requireFlipOwner);

router.get('/status', (req, res) => {
  res.json({ success: true, data: getFlipStatus() });
});

router.post('/sync', async (req, res) => {
  try {
    res.json({ success: true, data: await syncAllFlipFarms() });
  } catch (e) {
    fail(res, e);
  }
});

// Nút "Đang gom hàng": lấy giao dịch 10 giây một lần trong vài phút
router.post('/:farmId/burst', requireFlipOwner, (req, res) => {
  res.json({ success: true, data: startBurst(req.params.farmId, req.body?.minutes) });
});

router.delete('/:farmId/burst', requireFlipOwner, (req, res) => {
  res.json({ success: true, data: stopBurst(req.params.farmId) });
});

// Lệnh bù (ước tính) và lệnh nhập tay. Đọc danh sách qua GET /:farmId/adjustments (bảng phẳng bên dưới)
router.post('/:farmId/adjustments', requireFlipOwner, async (req, res) => {
  try {
    const result = await addAdjustment(req.params.farmId, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    res.json({ success: true, data: result.adjustment });
  } catch (e) {
    fail(res, e);
  }
});

router.patch('/:farmId/adjustments/:id', requireFlipOwner, async (req, res) => {
  try {
    const result = await updateAdjustment(req.params.farmId, req.params.id, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    if (result.notFound) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: result.adjustment });
  } catch (e) {
    fail(res, e);
  }
});

router.delete('/:farmId/adjustments/:id', requireFlipOwner, async (req, res) => {
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
router.get('/:farmId/sessions', requireFlipOwner, async (req, res) => {
  try {
    res.json({ success: true, data: await listSessions(req.params.farmId) });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/:farmId/sessions', requireFlipOwner, async (req, res) => {
  try {
    const result = await openSession(req.params.farmId, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    if (result.alreadyOpen) return res.status(409).json({ success: false, error: 'SESSION_OPEN', data: result.session });
    res.json({ success: true, data: result.session });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/:farmId/sessions/close', requireFlipOwner, async (req, res) => {
  try {
    const result = await closeSession(req.params.farmId, req.body || {});
    if (result.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: result.errors });
    res.json({ success: true, data: result.session });
  } catch (e) {
    fail(res, e);
  }
});

router.delete('/:farmId/sessions/:id', requireFlipOwner, async (req, res) => {
  try {
    const result = await deleteSession(req.params.farmId, req.params.id);
    if (result.notFound) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/:farmId', requireFlipOwner, async (req, res) => {
  try {
    res.json({ success: true, data: await buildFlipReport(req.params.farmId, req.query) });
  } catch (e) {
    fail(res, e);
  }
});

// Trả về mảng phẳng (summary là mảng 1 dòng) cho Power Query
router.get('/:farmId/:table', requireFlipOwner, async (req, res) => {
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
