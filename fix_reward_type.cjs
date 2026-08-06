require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fix() {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set in .env'); process.exit(1); }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const today = new Date().toISOString().split('T')[0];
    
    const doc = await col.findOne({ _id: "6279470157500012" });
    if (doc && doc.deliveries && doc.deliveries[today]) {
       const updatedDeliveries = doc.deliveries[today].map(d => {
          if (d.reward === 312 && !d.rewardType) {
             d.rewardType = 'Coins';
             d.reqItems = [];
          }
          return d;
       });
       const updateResult = await col.updateOne(
          { _id: "6279470157500012" },
          { 
            $set: { 
               [`deliveries.${today}`]: updatedDeliveries
            }
          }
       );
       console.log("Updated:", updateResult.modifiedCount);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

fix();
