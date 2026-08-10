const { MongoClient } = require('mongodb');
require('dotenv').config();
async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('sfl_tracker');
  const history = await db.collection('history').findOne({});
  if (history && history.cached_inventory) {
    console.log("Farm ID:", history._id);
    const fs = require('fs');
    fs.writeFileSync('user_farm_history.json', JSON.stringify(history, null, 2));
    console.log("Saved to user_farm_history.json");
  } else {
    console.log("No history found");
  }
  process.exit(0);
}
run();
