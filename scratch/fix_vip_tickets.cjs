const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sfl_tracker";

async function run() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const historyCollection = db.collection('history');

    const farms = await historyCollection.find({}).toArray();
    let updatedCount = 0;
    
    for (const farm of farms) {
      if (farm.daily_chest) {
        let changed = false;
        for (const date in farm.daily_chest) {
          if (farm.daily_chest[date].reward !== 2) {
            farm.daily_chest[date].reward = 2;
            changed = true;
          }
        }
        
        if (changed) {
          await historyCollection.updateOne({ _id: farm._id }, { $set: { daily_chest: farm.daily_chest } });
          updatedCount++;
          console.log(`Updated farm ${farm._id}`);
        }
      }
    }
    
    console.log(`Successfully reset VIP tickets to 2 for ${updatedCount} farms.`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

run();
