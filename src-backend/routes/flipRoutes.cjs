const express = require('express');
const router = express.Router();
const {
  requireFlipOwner,
  getFlipStatus,
  syncAllFlipFarms,
  buildFlipReport
} = require('../services/flipService.cjs');

// Các bảng lẻ để Excel (Power Query) đọc thẳng thành bảng
const TABLES = ['summary', 'resources', 'lots', 'daily', 'openLots', 'nonFlip'];

router.use(requireFlipOwner);

router.get('/status', (req, res) => {
  res.json({ success: true, data: getFlipStatus() });
});

router.post('/sync', async (req, res) => {
  try {
    res.json({ success: true, data: await syncAllFlipFarms() });
  } catch (e) {
    res.status(502).json({ success: false, error: e.message });
  }
});

router.get('/:farmId', requireFlipOwner, async (req, res) => {
  try {
    res.json({ success: true, data: await buildFlipReport(req.params.farmId, req.query) });
  } catch (e) {
    console.error('[Flip] Lỗi tạo báo cáo:', e);
    res.status(502).json({ success: false, error: e.message });
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
    res.json(table === 'summary' ? [{ ...report.summary, generatedAt: report.generatedAt }] : report[table]);
  } catch (e) {
    console.error('[Flip] Lỗi tạo báo cáo:', e);
    res.status(502).json({ success: false, error: e.message });
  }
});

module.exports = router;
