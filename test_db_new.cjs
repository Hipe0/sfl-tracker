const { MongoClient } = require('mongodb'); require('dotenv').config(); 
async function run() { 
  const client = new MongoClient(process.env.MONGODB_URI); 
  await client.connect(); 
  const db = client.db('sfl_tracker'); 
  const c = db.collection('market_prices'); 
  const itemName = 'Eggplant'; 
  const bucketSize = 15*60*1000; 
  const minTimestamp = Date.now() - (bucketSize * 1000); 
  const start = Date.now(); 
  
  const pipeline = [
    { $match: { $or: [ { timestamp: { $gte: minTimestamp } }, { timestamp: { $gte: new Date(minTimestamp) } } ], [`prices.${itemName}`]: { $exists: true } } }, 
    { $sort: { timestamp: 1 } }, 
    { $group: { 
      _id: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, bucketSize] }] }, 
      open: { $first: `$prices.${itemName}` }, 
      high: { $max: `$prices.${itemName}` }, 
      low: { $min: `$prices.${itemName}` }, 
      close: { $last: `$prices.${itemName}` }, 
      volume: { $sum: 0 } 
    } }, 
    { $sort: { _id: 1 } }, 
    { $project: { time: { $divide: ['$_id', 1000] }, open: 1, high: 1, low: 1, close: 1, volume: 1, _id: 0 } }
  ];
  
  try {
    const results = await c.aggregate(pipeline).toArray(); 
    console.log('Found', results.length, 'in', Date.now()-start, 'ms'); 
    if (results.length > 0) {
      console.log(results[0]);
    }
  } catch (err) {
    console.error(err);
  }
  await client.close(); 
} 
run();
