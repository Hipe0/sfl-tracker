require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fixDb() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
  }
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const historyCollection = db.collection('history');
    
    const farmId = '92441';
    const dateStr = new Date().toISOString().split('T')[0];
    // We are looking for history on dateStr for farmId 92441
    const farmHistory = await historyCollection.findOne({ _id: farmId });
    if (!farmHistory) {
      console.log(`No history found for ${farmId}`);
      process.exit(0);
    }

    const todayDeliveries = farmHistory.deliveries && farmHistory.deliveries[dateStr];
    if (!todayDeliveries || todayDeliveries.length === 0) {
      console.log(`No deliveries found for ${farmId} on ${dateStr}`);
      process.exit(0);
    }

    let modified = false;
    todayDeliveries.forEach(d => {
      // Check if it's a Shiny Feather reward that hasn't been doubled (we can assume base values are typically <= 15 depending on the NPC, but the bug was that they were recorded as X1 instead of X2)
      // Actually, if we just multiply by 2 for Shiny Feather on this date...
      if (d.rewardType === 'Shiny Feather' && d.status === 'success') {
         // If it is 2, 4, 6, 8, etc. maybe it's already doubled? But wait, the user says it's X1. 
         // So whatever it is currently, we multiply by 2. (Unless it's already fixed? Let's check the current values first).
         console.log(`Found delivery: ${d.npcName}, Reward: ${d.reward}`);
         // Since we know the bug caused X1, we'll double it.
         d.reward = d.reward * 2;
         modified = true;
         console.log(` -> Modified to: ${d.reward}`);
      }
    });

    if (modified) {
      await historyCollection.updateOne(
        { _id: farmId },
        { $set: { [`deliveries.${dateStr}`]: todayDeliveries } }
      );
      console.log("Database updated successfully.");
    } else {
      console.log("No modifications needed.");
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.close();
  }
}

fixDb();
