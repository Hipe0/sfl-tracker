const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const authRoutes = require('./src-backend/routes/authRoutes.cjs');
const farmRoutes = require('./src-backend/routes/farmRoutes.cjs');
const craftingRoutes = require('./src-backend/routes/craftingRoutes.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// Phục vụ ảnh từ game project gốc (thư mục ../src/assets)
app.use('/sfl-assets', express.static(path.join(__dirname, '../src/assets')));

// Initialize MongoDB and Start Server
initDB().then(() => {
  // Cron Endpoint (đặt trước các route khác để không bị ghi đè bởi /:id)
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  app.get('/api/cron', async (req, res) => {
    try {
      const farms = await getHistoryCollection().find({}, { projection: { _id: 1 } }).toArray();
      console.log(`[Cron] Triggering sync for ${farms.length} farms...`);
      
      // Chạy vòng lặp đồng bộ dưới nền (background) để không block HTTP request
      const runBackgroundSync = async () => {
        for (const doc of farms) {
           const farmId = doc._id;
           const url = `http://${req.headers.host || 'localhost:' + PORT}/api/farm/${farmId}?cron=true`;
           try {
             await fetch(url);
             console.log(`[Cron] Successfully synced farm ${farmId}`);
             await sleep(5000); // Mức an toàn cho Render
           } catch (e) {
             console.error(`[Cron] Failed to sync farm ${farmId}:`, e.message);
           }
        }
        console.log(`[Cron] Finished background sync for ${farms.length} farms.`);
      };
      
      // Bắt đầu chạy hàm dưới nền mà không dùng await
      runBackgroundSync();
      
      // Phản hồi ngay lập tức cho cron-job.org để tránh lỗi timeout
      res.json({ success: true, message: `Background sync triggered for ${farms.length} farms` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Routes
  app.get('/api/assets-map', require('./src-backend/controllers/assetsController.cjs').getAssetsMap);
  app.use('/api', authRoutes);
  app.use('/api/farm', farmRoutes);
  app.use('/api/crafting-costs', craftingRoutes);
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

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    
    // Bắt đầu đồng bộ nền cho các phiên đấu giá
    const { startBackgroundAuctionSync } = require('./src-backend/services/sflApiService.cjs');
    startBackgroundAuctionSync();
  });
}).catch(err => {
  console.error("Failed to start server due to DB init error", err);
  process.exit(1);
});
