const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const authRoutes = require('./src-backend/routes/authRoutes.cjs');
const farmRoutes = require('./src-backend/routes/farmRoutes.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize MongoDB and Start Server
initDB().then(() => {
  // Routes
  app.use('/api', authRoutes);
  app.use('/api/farm', farmRoutes);

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

  // Cron Endpoint
  app.get('/api/cron', async (req, res) => {
    try {
      const farms = await getHistoryCollection().find({}, { projection: { _id: 1 } }).toArray();
      console.log(`[Cron] Triggering sync for ${farms.length} farms...`);
      for (const doc of farms) {
         const farmId = doc._id;
         const url = `http://${req.headers.host || 'localhost:' + PORT}/api/farm/${farmId}`;
         try {
           await fetch(url);
           console.log(`[Cron] Successfully synced farm ${farmId}`);
         } catch (e) {
           console.error(`[Cron] Failed to sync farm ${farmId}:`, e.message);
         }
      }
      res.json({ success: true, message: "Sync triggered via API" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server due to DB init error", err);
  process.exit(1);
});
