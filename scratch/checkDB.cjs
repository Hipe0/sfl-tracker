require('dotenv').config();
const { MongoClient } = require('mongodb'); 
async function run() { 
  const uri = process.env.MONGODB_URI; 
  const client = new MongoClient(uri); 
  await client.connect(); 
  const db = client.db('sfl_tracker'); 
  const data = await db.collection('market_prices').find({
    timestamp: {$gte: new Date('2026-09-13T00:00:00Z').getTime(), $lt: new Date('2026-09-14T00:00:00Z').getTime()},
    'prices.Olive': {$exists: true}
  }).sort({timestamp: 1}).toArray(); 
  console.log(data.map(d => ({
    t: new Date(Number(d.timestamp)).toISOString(), 
    price: d.prices.Olive
  }))); 
  await client.close(); 
} 
run();
