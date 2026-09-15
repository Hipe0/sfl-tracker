const express = require('express');
const router = express.Router();
const { getOHLCV } = require('../services/priceHistoryService.cjs');
const { getSupplyStats } = require('../services/blockchainService.cjs');

router.get('/history/:itemName', async (req, res) => {
  try {
    const itemName = req.params.itemName;
    const granularity = req.query.granularity || '1h'; // default to 1 hour
    const limit = parseInt(req.query.limit) || 100;
    
    const data = await getOHLCV(itemName, granularity, limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[MarketRoutes] Error fetching OHLCV for ${req.params.itemName}`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/supply/:itemName', async (req, res) => {
  try {
    const itemName = req.params.itemName;
    const data = await getSupplyStats(itemName);
    res.json({ success: true, data });
  } catch (error) {
    console.error(`[MarketRoutes] Error fetching Supply for ${req.params.itemName}`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
