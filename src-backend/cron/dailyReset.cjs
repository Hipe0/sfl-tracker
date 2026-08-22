const cron = require('node-cron');
const { getHistoryCollection } = require('../config/db.cjs');
const jwt = require('jsonwebtoken');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function setupCronJobs(port) {
  // Set up node-cron for local environment running at 00:02 UTC (7:02 AM VN)
  cron.schedule('2 0 * * *', async () => {
    console.log('[Local Cron] Running daily sync task at 00:02 UTC');
    try {
      const historyCollection = getHistoryCollection();
      const farms = await historyCollection.find({}, { projection: { _id: 1 } }).toArray();
      for (const doc of farms) {
         const farmId = doc._id;
         const url = `http://localhost:${port}/api/farm/${farmId}?cron=true`;
         try {
           const token = jwt.sign({ farmId }, process.env.JWT_SECRET || 'sfl-tracker-secret', { expiresIn: '1h' });
           const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
           if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
           console.log(`[Local Cron] Successfully synced farm ${farmId}`);
           await sleep(5000); // Delay 5 giây giữa các lượt quét
         } catch (e) {
           console.error(`[Local Cron] Failed to sync farm ${farmId}:`, e.message);
         }
      }
    } catch (e) {
      console.error('[Local Cron] Error fetching farms from DB:', e);
    }
  });

  // Set up node-cron for local environment running at 23:45 UTC (6:45 AM VN)
  cron.schedule('45 23 * * *', async () => {
    console.log('[Local Cron] Running pre-reset sync task at 23:45 UTC');
    try {
      const historyCollection = getHistoryCollection();
      const farms = await historyCollection.find({}, { projection: { _id: 1 } }).toArray();
      for (const doc of farms) {
         const farmId = doc._id;
         const url = `http://localhost:${port}/api/farm/${farmId}?cron=true`;
         try {
           const token = jwt.sign({ farmId }, process.env.JWT_SECRET || 'sfl-tracker-secret', { expiresIn: '1h' });
           const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
           if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
           console.log(`[Local Cron] Successfully synced farm ${farmId} (pre-reset)`);
           await sleep(5000); // Delay 5 giây giữa các lượt quét
         } catch (e) {
           console.error(`[Local Cron] Failed to sync farm ${farmId} (pre-reset):`, e.message);
         }
      }
    } catch (e) {
      console.error('[Local Cron] Error fetching farms from DB (pre-reset):', e);
    }
  });
}

module.exports = { setupCronJobs };
