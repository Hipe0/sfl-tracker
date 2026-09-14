const { MongoClient } = require('mongodb'); require('dotenv').config(); 
async function run() { 
  const client = new MongoClient(process.env.MONGODB_URI); 
  await client.connect(); 
  const db = client.db('sfl_tracker'); 
  const c = db.collection('market_prices'); 
  const docs = await c.find({ timestamp: { $type: 'date' } }).toArray(); 
  let ops = []; 
  for (const d of docs) { 
    ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: { timestamp: d.timestamp.getTime() } } } }); 
    if (ops.length === 500) { 
      await c.bulkWrite(ops); 
      ops = []; 
    } 
  } 
  if (ops.length > 0) await c.bulkWrite(ops); 
  console.log('Fixed', docs.length, 'dates to numbers'); 
  await client.close(); 
} 
run();
