const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('sfl_tracker');
  
  // Find all users who have baseline_daily_reward set
  // and unset it, as well as clearing their vip_gift for the current week
  // so the retroactive logic can run cleanly for everyone!
  const res = await db.collection('history').updateMany(
    {},
    { $unset: { baseline_daily_reward: 1, "vip_gift.2026-W32": 1 } }
  );
  
  console.log(`Reset ${res.modifiedCount} documents.`);
  await client.close();
}
run();
