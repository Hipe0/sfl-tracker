const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fixDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const collection = db.collection('market_prices');
    
    // Find documents where Pumpkin price is absurdly high
    const query = { "prices.Pumpkin": { $gt: 10 } };
    const count = await collection.countDocuments(query);
    console.log(`Found ${count} documents with absurd Pumpkin prices.`);
    
    if (count > 0) {
      const res = await collection.deleteMany(query);
      console.log(`Deleted ${res.deletedCount} documents.`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

fixDB();
