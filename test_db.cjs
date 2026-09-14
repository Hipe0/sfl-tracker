const { MongoClient } = require('mongodb'); require('dotenv').config(); 
async function run() { 
  const client = new MongoClient(process.env.MONGODB_URI); 
  await client.connect(); 
  const db = client.db('sfl_tracker'); 
  const c = db.collection('market_prices'); 
  const count = await c.countDocuments({ 'prices.Eggplant': { $exists: true } }); 
  console.log('Total Eggplant docs:', count); 
  const sample = await c.find({ 'prices.Eggplant': { $exists: true } }).sort({ _id: 1 }).limit(1).toArray(); 
  console.log('Oldest:', sample[0]); 
  
  const lastSample = await c.find({ 'prices.Eggplant': { $exists: true } }).sort({ _id: -1 }).limit(1).toArray(); 
  console.log('Newest:', lastSample[0]); 
  
  await client.close(); 
} 
run();
