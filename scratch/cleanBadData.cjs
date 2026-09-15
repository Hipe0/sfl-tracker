const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('sfl_tracker');
  const col = db.collection('market_prices');
  
  const docs = await col.find({}).toArray();
  let toDelete = [];
  
  docs.forEach(d => {
    const date = new Date(d.timestamp);
    const h = date.getUTCHours();
    const m = date.getUTCMinutes();
    const s = date.getUTCSeconds();
    
    // Xóa các điểm giả lập (Open, Low, High) được tạo bởi script backfill
    if ((h === 0 && m === 0 && s === 1) || 
        (h === 6 && m === 0 && s === 0) || 
        (h === 12 && m === 0 && s === 0)) {
      toDelete.push(d._id);
    }
  });
  
  if (toDelete.length > 0) {
    const res = await col.deleteMany({ _id: { $in: toDelete } });
    console.log('Deleted fake OHLC points:', res.deletedCount);
  } else {
    console.log('No fake OHLC points found.');
  }
  
  await client.close();
}

run().catch(console.error);
