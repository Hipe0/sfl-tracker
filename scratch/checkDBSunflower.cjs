require('dotenv').config();
const { MongoClient } = require('mongodb'); 
async function run() { 
  const uri = process.env.MONGODB_URI; 
  const client = new MongoClient(uri); 
  await client.connect(); 
  const db = client.db('sfl_tracker'); 
  const data = await db.collection('market_prices').find({
    'prices.Sunflower': {$exists: true}
  }).sort({timestamp: -1}).limit(1).toArray(); 
  console.log(data.map(d => ({
    t: new Date(Number(d.timestamp)).toISOString(), 
    price: d.prices.Sunflower,
    listings: d.listings?.Sunflower,
    supplies: d.supplies?.Sunflower,
    vol: d.volumes?.Sunflower
  }))); 
  await client.close(); 
} 
run();
