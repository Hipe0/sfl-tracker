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
      if (farm.daily_chest && Object.keys(farm.daily_chest).length > 0) {
        // The user wants to reset the VIP chest data to explicitly have
        // exactly 1 ticket for Aug 3 and 1 ticket for Aug 4.
        const newDailyChest = {
          "2026-08-03": {
            reward: 1,
            timestamp: new Date("2026-08-03T12:00:00Z").getTime()
          },
          "2026-08-04": {
            reward: 1,
            timestamp: new Date("2026-08-04T12:00:00Z").getTime()
          }
        };
        
        await historyCollection.updateOne({ _id: farm._id }, { $set: { daily_chest: newDailyChest } });
        updatedCount++;
        console.log(`Updated farm ${farm._id} to have +1 for 03/08 and +1 for 04/08`);
      }
    }
    
    console.log(`Successfully reset VIP tickets for ${updatedCount} farms.`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

run();
