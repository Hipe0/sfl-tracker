require('dotenv').config();
const { MongoClient } = require('mongodb'); 
async function run() { 
  const uri = process.env.MONGODB_URI; 
  const client = new MongoClient(uri); 
  await client.connect(); 
  const db = client.db('sfl_tracker'); 
  const data = await db.collection('market_prices').find({
    'supplies.Soybean': {$exists: true}
  }).sort({timestamp: -1}).limit(10).toArray(); 
  console.log(data.map(d => ({t: new Date(Number(d.timestamp)).toISOString(), supply: d.supplies.Soybean}))); 
  await client.close(); 
} 
run();
