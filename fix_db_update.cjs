const { MongoClient } = require('mongodb'); require('dotenv').config(); 
async function run() { 
  const client = new MongoClient(process.env.MONGODB_URI); 
  await client.connect(); 
  const db = client.db('sfl_tracker'); 
  const c = db.collection('market_prices'); 
  try {
    const result = await c.updateMany(
      { timestamp: { $type: 'date' } },
      [{ $set: { timestamp: { $toLong: "$timestamp" } } }]
    );
    console.log(`Matched ${result.matchedCount} and modified ${result.modifiedCount} documents.`);
  } catch (err) {
    console.error(err);
  }
  await client.close(); 
} 
run();
