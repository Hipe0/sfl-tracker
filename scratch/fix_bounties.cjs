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
      if (farm.bounties_completed) {
        let changed = false;
        const newBounties = {};
        for (const [key, b] of Object.entries(farm.bounties_completed)) {
          if (!key.includes('-W')) { // If it doesn't have the weekStr prefix
             const newKey = `${b.week}-${key}`;
             newBounties[newKey] = { ...b, originalName: key };
             changed = true;
          } else {
             newBounties[key] = b;
          }
        }
        
        if (changed) {
          await historyCollection.updateOne({ _id: farm._id }, { $set: { bounties_completed: newBounties } });
          updatedCount++;
          console.log(`Updated bounties for farm ${farm._id}`);
        }
      }
    }
    
    console.log(`Successfully migrated bounties for ${updatedCount} farms.`);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

run();
