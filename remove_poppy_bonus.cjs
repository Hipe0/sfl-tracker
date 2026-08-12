require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const result = await db.collection('history').updateMany(
      { 'bounties_completed.2026-W33-Poppy Bounty Bonus-poppy_bonus': { $exists: true } },
      { $unset: { 'bounties_completed.2026-W33-Poppy Bounty Bonus-poppy_bonus': '' } }
    );
    console.log(`Removed Poppy Bonus from ${result.modifiedCount} farms for W33.`);
  } finally {
    await client.close();
  }
}

run().catch(console.error);
