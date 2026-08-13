require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fixDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
     console.log("No URI");
     return;
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('sfl_tracker');
  const historyCol = db.collection('history');
  
  const allDocs = await historyCol.find({}).toArray();
  let modifiedCount = 0;
  
  for (const doc of allDocs) {
    let changed = false;
    
    if (doc.deliveries) {
      for (const date in doc.deliveries) {
        const deliveriesArray = doc.deliveries[date];
        if (Array.isArray(deliveriesArray)) {
          const originalLength = deliveriesArray.length;
          
          // Keep ONLY Shiny Feather
          const filtered = deliveriesArray.filter(d => {
             const type = (d.rewardType || '').toLowerCase();
             // Delete if it is coins, sfl, or flower
             if (type === 'coins' || type === 'sfl' || type === 'flower') {
                 return false;
             }
             return true;
          });
          
          if (filtered.length !== originalLength) {
            doc.deliveries[date] = filtered;
            changed = true;
          }
        }
      }
    }
    
    if (changed) {
      await historyCol.updateOne({ _id: doc._id }, { $set: { deliveries: doc.deliveries } });
      modifiedCount++;
      console.log(`Fixed farm ${doc._id}`);
    }
  }
  
  console.log(`Done! Modified ${modifiedCount} farms.`);
  process.exit(0);
}

fixDB().catch(console.error);
