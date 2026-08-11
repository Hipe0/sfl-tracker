const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function checkDB() {
  await initDB();
  const collection = getHistoryCollection();
  const id = "6279470157500012";
  const doc = await collection.findOne({ _id: id });
  if (doc) {
    console.log("Found history for", id);
    const dates = Object.keys(doc.deliveries || {}).slice(-3); // last 3 days
    for (const date of dates) {
       console.log(`\n--- Date: ${date} ---`);
       const deliveries = doc.deliveries[date] || [];
       const finn = deliveries.filter(d => d.npcName.toLowerCase() === 'finn');
       console.log("Finn deliveries:", JSON.stringify(finn, null, 2));
    }
    console.log("\n--- Active Deliveries ---");
    console.log(JSON.stringify(doc.active_deliveries, null, 2));
  } else {
    console.log("No history found for", id);
  }
  process.exit(0);
}

checkDB();
