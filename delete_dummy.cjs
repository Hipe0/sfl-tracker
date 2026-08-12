require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const h = await db.collection('history').findOne({_id: '8052347903218326'});
    
    if (h && h.bounties_completed) {
      if (h.bounties_completed['2026-W33-Database-Fix-Bounties']) {
        delete h.bounties_completed['2026-W33-Database-Fix-Bounties'];
        await db.collection('history').updateOne({_id: '8052347903218326'}, { $set: { bounties_completed: h.bounties_completed } });
        console.log('Deleted successfully.');
      } else {
        console.log('No dummy keys found.');
      }
    }
  } finally {
    await client.close();
  }
}

run().catch(console.error);
