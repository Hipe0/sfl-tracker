const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farmController.cjs');

// Route cho đấu giá
router.get('/auctions', farmController.getAuctionsList);
router.get('/auctions/:id', farmController.getAuctionLeaderboard);

// Route for calculating crop coin values
router.get('/crop-coins', farmController.getCropCoins);

// Route for getting farm history
router.get('/:id/history', farmController.getFarmHistory);

// Route for getting detailed farm data (Main Tracker API)
router.get('/:id', farmController.getFarmData);

module.exports = router;
