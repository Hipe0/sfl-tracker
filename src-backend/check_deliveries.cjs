require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkDB() {
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
  let totalDeleted = 0;
  let totalKept = 0;
  let summaryDeleted = {};
  
  for (const doc of allDocs) {
    if (doc.deliveries) {
      for (const date in doc.deliveries) {
        const deliveriesArray = doc.deliveries[date];
        if (Array.isArray(deliveriesArray)) {
          deliveriesArray.forEach(d => {
             const type = (d.rewardType || '').toLowerCase();
             if (type === 'coins' || type === 'sfl' || type === 'flower') {
                totalDeleted++;
                summaryDeleted[type] = (summaryDeleted[type] || 0) + 1;
             } else {
                totalKept++;
             }
          });
        }
      }
    }
  }
  
  console.log(`Total deliveries to DELETE: ${totalDeleted}`);
  console.log('Breakdown to delete:', summaryDeleted);
  console.log(`Total deliveries to KEEP: ${totalKept}`);
  
  process.exit(0);
}

checkDB().catch(console.error);
