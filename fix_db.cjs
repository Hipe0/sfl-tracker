const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function fixDB() {
  await initDB();
  const collection = getHistoryCollection();
  const id = "6279470157500012";
  const doc = await collection.findOne({ _id: id });
  
  if (doc) {
    console.log("Found history, fixing...");
    
    // Fix 2026-08-10
    if (doc.deliveries && doc.deliveries["2026-08-10"]) {
      const idx = doc.deliveries["2026-08-10"].findIndex(d => d.npcName === "Finn" && d.count === 15);
      if (idx !== -1) {
        doc.deliveries["2026-08-10"][idx] = {
          ...doc.deliveries["2026-08-10"][idx],
          reward: 18,
          reqItems: [
            { name: "Old Snapper", total: 10, completed: 10, enough: true },
            { name: "Crimstone", total: 2, completed: 2, enough: true } // Mỏ muối = Crimstone or Salt
          ]
        };
        console.log("Fixed 2026-08-10 Finn order");
      }
    }
    
    // Fix 2026-08-11
    if (doc.deliveries && doc.deliveries["2026-08-11"]) {
      const idx = doc.deliveries["2026-08-11"].findIndex(d => d.npcName === "Finn" && d.count === 16);
      if (idx !== -1) {
        doc.deliveries["2026-08-11"][idx] = {
          ...doc.deliveries["2026-08-11"][idx],
          reward: 10,
          reqItems: [
            { name: "Leather", total: 7, completed: 7, enough: true },
            { name: "Red Snapper", total: 8, completed: 8, enough: true }
          ]
        };
        console.log("Fixed 2026-08-11 Finn order");
      }
    }
    
    await collection.updateOne({ _id: id }, { $set: { deliveries: doc.deliveries } });
    console.log("Database updated successfully!");
  } else {
    console.log("No history found for", id);
  }
  process.exit(0);
}

fixDB();
