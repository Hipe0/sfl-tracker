const { MongoClient } = require('mongodb');
require('dotenv').config();

async function seed() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const collection = db.collection('market_prices');

    const cursor = collection.find({}).sort({ timestamp: 1 });
    let count = 0;
    
    // Simulate some base supply and volume
    const baseSupplies = {};
    const baseVolumes = {};
    
    for await (const doc of cursor) {
      let updated = false;
      const newVolumes = doc.volumes || {};
      const newSupplies = doc.supplies || {};
      
      for (const item of Object.keys(doc.prices)) {
        if (!baseSupplies[item]) {
          baseSupplies[item] = Math.floor(Math.random() * 50000) + 10000;
          baseVolumes[item] = Math.floor(Math.random() * 100000) + 20000;
        }
        
        baseSupplies[item] += Math.floor(Math.random() * 50);
        baseVolumes[item] += Math.floor(Math.random() * 200);
        
        if (newSupplies[item] === undefined || newSupplies[item] === 0) {
           newSupplies[item] = baseSupplies[item];
           newVolumes[item] = baseVolumes[item];
           updated = true;
        }
      }
      
      if (updated) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { supplies: newSupplies, volumes: newVolumes } }
        );
        count++;
        if (count % 100 === 0) console.log(`Updated ${count} documents...`);
      }
    }
    console.log(`Finished updating ${count} documents with missing mock volume and supply.`);
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

seed();
