require('dotenv').config();
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI");
    return;
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const coll = db.collection('history');
    
    // We want to remove all deliveries in history documents 
    // where rewardType is NOT "Shiny Feather" (or where it is Coins/Flower)
    
    // Let's first get all documents
    const docs = await coll.find({}).toArray();
    let updated = 0;
    
    for (const doc of docs) {
      if (!doc.deliveries) continue;
      
      let changed = false;
      const newDeliveries = {};
      
      for (const [timestamp, delivery] of Object.entries(doc.deliveries)) {
        if (delivery.rewardType === 'Shiny Feather' || delivery.rewardType === 'Gem' || delivery.rewardType === 'Trade') {
          newDeliveries[timestamp] = delivery; // keep
        } else {
          changed = true; // remove
        }
      }
      
      if (changed) {
        await coll.updateOne({ _id: doc._id }, { $set: { deliveries: newDeliveries } });
        updated++;
      }
    }
    
    console.log(`Removed non-ticket deliveries from ${updated} documents.`);
  } finally {
    await client.close();
  }
}

run().catch(console.error);
