const express = require('express');
const router = express.Router();
const { getOHLCV } = require('../services/priceHistoryService.cjs');
const { requireFlipAccess } = require('../services/flipService.cjs');
const market = require('../services/marketService.cjs');
const collector = require('../jobs/marketCollector.cjs');

const fail = (res, e) => {
  console.error('[Market] Lỗi:', e);
  res.status(502).json({ success: false, error: e.message });
};

// Trang Thị trường & Điểm mua, Mùa & Nhu cầu: chỉ chủ app (mã FLIP_OWNER_KEY). Người dùng thường chỉ có Sổ Flip.
const ownerOnly = (req, res, next) => (req.flip?.role === 'owner' ? next() : res.status(403).json({ success: false, error: 'OWNER_ONLY' }));
router.use(requireFlipAccess, ownerOnly);

const farmOf = req => req.flip?.farms?.[0];

router.get('/calendar', (req, res) => {
  res.json({ success: true, data: market.getCalendar() });
});

// Faction Pet (đua pet) + Kitchen tuần này và tuần sau, theo lịch xoay vòng 12 tuần (không gọi API game)
router.get('/faction-week', (req, res) => {
  const { factionWeek } = require('../domain/factionRotation.cjs');
  const now = Date.now();
  res.json({ success: true, data: { thisWeek: factionWeek(now), nextWeek: factionWeek(now + 7 * 24 * 60 * 60 * 1000) } });
});

router.get('/overview', async (req, res) => {
  try {
    res.json({ success: true, data: await market.getOverview(req.query.range) });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/signals', async (req, res) => {
  try {
    res.json({ success: true, data: await market.getSignals({ farmId: farmOf(req) }) });
  } catch (e) {
    fail(res, e);
  }
});

// Hàng đang giữ trong Sổ Flip của chủ app, kèm giá bán mục tiêu theo vòng mùa
router.get('/holdings', async (req, res) => {
  try {
    res.json({ success: true, data: await market.getHoldings(req.flip.farms) });
  } catch (e) {
    fail(res, e);
  }
});

// Bỏ / hiện lại 1 món trong "Hàng đang giữ" (món mua để dùng, không bán). body: { item, ignore: true|false, farmId? }
router.post('/holdings/ignore', async (req, res) => {
  try {
    const farmId = req.body?.farmId && req.flip.farms.map(String).includes(String(req.body.farmId)) ? req.body.farmId : farmOf(req);
    const r = await market.setHoldIgnore(farmId, req.body?.item, req.body?.ignore !== false);
    if (r.errors) return res.status(400).json({ success: false, error: 'Thiếu tên món', fields: { item: 'Cần tên món' } });
    res.json({ success: true, data: r });
  } catch (e) {
    fail(res, e);
  }
});

// Tự đánh dấu đã / chưa list 1 món đang giữ (khi API chưa kịp thấy lệnh treo). body: { item, listed: true|false, farmId? }
router.post('/holdings/listed', async (req, res) => {
  try {
    const farmId = req.body?.farmId && req.flip.farms.map(String).includes(String(req.body.farmId)) ? req.body.farmId : farmOf(req);
    const r = await market.setHoldListed(farmId, req.body?.item, req.body?.listed !== false);
    if (r.errors) return res.status(400).json({ success: false, error: 'Thiếu tên món', fields: { item: 'Cần tên món' } });
    res.json({ success: true, data: r });
  } catch (e) {
    fail(res, e);
  }
});

// Bản rút gọn cho trang /widget (hình nền, màn hình khoá): top Mua + hàng đang giữ, chỉ đọc DB
router.get('/widget', async (req, res) => {
  try {
    const [{ signals, updatedAt, taxRate }, { rows }] = await Promise.all([
      market.getSignals({ farmId: farmOf(req) }),
      market.getHoldings(req.flip.farms)
    ]);
    const buys = signals.filter(s => s.decision === 'buy').map(s => ({
      item: s.item, rank: s.rank ?? null, price: s.price ?? null, buyPrice: s.buyPrice, buyBy: s.buyBy ?? null,
      sellTarget: s.sellTarget, sellBy: s.sellBy ?? null, netMargin: s.netMargin
    }));
    const holdings = rows.map(h => ({
      item: h.item, qty: h.qty, avgCost: h.avgCost, price: h.price, netNow: h.netNow, target: h.target,
      netAtTarget: h.netAtTarget, sellBy: h.sellBy, action: h.action, note: h.note
    }));
    res.json({ success: true, data: { updatedAt, taxRate, buys, holdings } });
  } catch (e) {
    fail(res, e);
  }
});

// Đề xuất Mua đã đưa ra và kết quả thật (khớp offer? bán được? lãi?)
router.get('/recos', async (req, res) => {
  try {
    res.json({ success: true, data: await require('../jobs/recoTracker.cjs').getRecoStats() });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/items/:item', async (req, res) => {
  try {
    const data = await market.getItemHistory(req.params.item, {
      granularity: ['15m', '1h', '4h', '1d'].includes(req.query.granularity) ? req.query.granularity : '1d',
      range: req.query.range,
      farmId: farmOf(req)
    });
    res.json({ success: true, data });
  } catch (e) {
    fail(res, e);
  }
});

router.get('/status', (req, res) => {
  res.json({ success: true, data: collector.getStatus() });
});

// Nhu cầu theo chapter (đua pet, nhiệm vụ tuần, chế bánh...): chỉ chủ app xem và sửa

router.get('/demand', async (req, res) => {
  try {
    res.json({ success: true, data: await market.listDemand() });
  } catch (e) {
    fail(res, e);
  }
});

router.post('/demand', ownerOnly, async (req, res) => {
  try {
    const r = await market.addDemand(req.body);
    if (r.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: r.errors });
    res.json({ success: true, data: r.demand });
  } catch (e) {
    fail(res, e);
  }
});

router.put('/demand/:id', ownerOnly, async (req, res) => {
  try {
    const r = await market.updateDemand(req.params.id, req.body);
    if (r.errors) return res.status(400).json({ success: false, error: 'INVALID', fields: r.errors });
    if (r.notFound) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: r.demand });
  } catch (e) {
    fail(res, e);
  }
});

router.delete('/demand/:id', ownerOnly, async (req, res) => {
  try {
    const r = await market.deleteDemand(req.params.id);
    if (r.notFound) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true });
  } catch (e) {
    fail(res, e);
  }
});

// Route cũ (nến từ market_prices), giữ để không gãy công cụ ngoài đang gọi
router.get('/history/:itemName', async (req, res) => {
  try {
    const data = await getOHLCV(req.params.itemName, req.query.granularity || '1h', parseInt(req.query.limit) || 100);
    res.json({ success: true, data });
  } catch (error) {
    fail(res, error);
  }
});

module.exports = router;
