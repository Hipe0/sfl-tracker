const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const authRoutes = require('./src-backend/routes/authRoutes.cjs');
const farmRoutes = require('./src-backend/routes/farmRoutes.cjs');
const craftingRoutes = require('./src-backend/routes/craftingRoutes.cjs');
const marketRoutes = require('./src-backend/routes/marketRoutes.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ ảnh tĩnh (assets) trực tiếp từ thư mục public của dự án hiện tại thay vì thư mục bên ngoài
app.use('/sfl-assets', express.static(path.join(__dirname, 'public', 'sfl-assets')));

// Initialize MongoDB and Start Server
initDB().then(() => {
  // Ping Endpoint để giữ server luôn thức (Dùng cho cron-job.org)
  app.get('/api/ping', (req, res) => {
    res.json({ success: true, message: "Backend is awake!", time: new Date().toISOString() });
  });

  // Báo cáo FLIP chỉ dành cho chủ farm: không bật (404) trừ khi FLIP_ENABLED=true và có FLIP_OWNER_KEY
  const { isFlipEnabled, startFlipSync } = require('./src-backend/services/flipService.cjs');
  if (isFlipEnabled()) {
    app.use('/api/flip', require('./src-backend/routes/flipRoutes.cjs'));
  }

  // Routes
  app.get('/api/assets-map', require('./src-backend/controllers/assetsController.cjs').getAssetsMap);
  app.use('/api', authRoutes);
  app.use('/api/farm', farmRoutes);
  app.use('/api/crafting-costs', craftingRoutes);
  app.use('/api/market', marketRoutes);
  app.use('/api', farmRoutes); // Expose /api/crop-coins (route is ordered before /:id in farmRoutes)

  // System Endpoints
  const { sflCommunityQueue, sflWorldQueue } = require('./src-backend/utils/apiQueue.cjs');
  app.get('/api/system/queue-status', (req, res) => {
    res.json({
      success: true,
      data: {
        sflCommunity: sflCommunityQueue.getQueueStatus(),
        sflWorld: sflWorldQueue.getQueueStatus()
      }
    });
  });

  const { syncTrackedFarms, startFarmSync, getFarmSyncStatus } = require('./src-backend/services/farmSyncService.cjs');
  app.get('/api/system/farm-sync', (req, res) => {
    res.json({ success: true, data: getFarmSyncStatus() });
  });

  // Cho cron bên ngoài (Vercel Cron, cron-job.org) gọi khi server không chạy liên tục.
  // Cần header Authorization: Bearer <CRON_SECRET>
  app.get('/api/cron/farm-sync', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }
    try {
      const result = await syncTrackedFarms();
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(502).json({ success: false, error: e.message });
    }
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    
    // Bắt đầu đồng bộ nền cho các phiên đấu giá
    const { startBackgroundAuctionSync } = require('./src-backend/services/sflApiService.cjs');
    startBackgroundAuctionSync();

    // Đồng bộ dữ liệu các farm đang theo dõi vào MongoDB mỗi phút
    startFarmSync();

    // Lưu giao dịch marketplace của các farm trong FLIP_FARM_IDS: 1 phút một lần, đang gom hàng thì 10 giây
    startFlipSync();


  });
}).catch(err => {
  console.error("Failed to start server due to DB init error", err);
  process.exit(1);
});


