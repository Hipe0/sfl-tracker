const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("No MONGODB_URI found");
    process.exit(1);
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const result = await col.updateMany({}, {
      $set: {
        deliveries: {},
        chores: {},
        bounties_completed: {},
        animals_completed: {},
        npc_stats: {},
        delivery_stats: { fulfilledCount: 0 },
        active_deliveries: {},
        cached_orders: []
      }
    });
    
    console.log(`Cleared history data for ${result.modifiedCount} farms, kept daily_chest.`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
