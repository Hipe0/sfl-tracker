require('dotenv').config();
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log("Connected successfully to server");
    const db = client.db('sfl_tracker');
    const collection = db.collection('history');

    const dbPath = path.join(__dirname, 'database.json');
    if (!fs.existsSync(dbPath)) {
      console.log("database.json not found, nothing to migrate.");
      return;
    }

    const localDbStr = fs.readFileSync(dbPath, 'utf8');
    let localDb;
    try {
      localDb = JSON.parse(localDbStr);
    } catch (e) {
      console.error("Failed to parse database.json");
      return;
    }

    const farmIds = Object.keys(localDb);
    console.log(`Found ${farmIds.length} farms in database.json`);

    for (const farmId of farmIds) {
      const data = localDb[farmId];
      await collection.updateOne(
        { _id: farmId }, // Use farmId as the document _id
        { $set: data },
        { upsert: true }
      );
      console.log(`Migrated data for farm: ${farmId}`);
    }

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.close();
  }
}

migrate();
