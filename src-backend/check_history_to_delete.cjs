const { MongoClient } = require('mongodb');
require('dotenv').config({path: '../.env'});

async function main() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const historyCollection = db.collection('history');

    const allFarms = await historyCollection.find({}).toArray();
    let totalRemoved = 0;

    for (const farm of allFarms) {
      let changed = false;
      const deliveries = farm.deliveries || {};
      
      for (const [date, dailyDeliveries] of Object.entries(deliveries)) {
        if (!Array.isArray(dailyDeliveries)) continue;
        
        const originalLength = dailyDeliveries.length;
        // Keep ONLY if rewardType is 'Shiny Feather'
        const filtered = dailyDeliveries.filter(d => {
           return d.rewardType === 'Shiny Feather';
        });
        
        if (filtered.length !== originalLength) {
           deliveries[date] = filtered;
           totalRemoved += (originalLength - filtered.length);
           changed = true;
        }
      }

      if (changed) {
         await historyCollection.updateOne({ _id: farm._id }, { $set: { deliveries } });
         console.log(`Updated farm ${farm._id}, removed some coin/flower deliveries.`);
      }
    }
    
    console.log(`Total coin/flower deliveries removed: ${totalRemoved}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
