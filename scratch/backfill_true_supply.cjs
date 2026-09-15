const { MongoClient } = require('mongodb');
const blockchainService = require('../src-backend/services/blockchainService.cjs');
require('dotenv').config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

const itemsToFix = [
  "Wood", "Stone", "Iron", "Gold", 
  "Sunflower", "Potato", "Pumpkin", "Carrot", "Cabbage", "Beetroot", "Cauliflower", "Parsnip", "Radish", "Wheat", "Kale", "Soybean",
  "Apple", "Blueberry", "Orange", "Egg", "Honey", "Milk",
  "Blueberry", "Orange", "Apple", "Banana", "Tomato", "Lemon"
];

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('sfl_tracker');
  const collection = db.collection('market_prices');
  
  console.log("Fetching true blockchain supply for items...");
  const trueSupplies = {};
  
  for (const itemName of itemsToFix) {
    try {
      const stats = await blockchainService.getSupplyStats(itemName);
      if (stats && stats.active > 0) {
        trueSupplies[itemName] = {
          active: stats.active,
          total: stats.total
        };
        console.log(`[${itemName}] Active: ${stats.active} | Total: ${stats.total}`);
      }
    } catch (e) {
      console.log(`Failed to fetch for ${itemName}: ${e.message}`);
    }
    // Small delay to prevent rate limit
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log("Backfilling historical data with true supply...");
  
  // We just overwrite the supplies object for ALL records in market_prices 
  // so the historical chart becomes flat but accurate.
  const records = await collection.find({}).toArray();
  let count = 0;
  for (const record of records) {
    const updatedSupplies = {};
    for (const [itemName, val] of Object.entries(record.supplies || {})) {
      if (trueSupplies[itemName]) {
        updatedSupplies[itemName] = trueSupplies[itemName];
      } else {
        // keep the old structure if not found
        updatedSupplies[itemName] = val;
      }
    }
    
    await collection.updateOne(
      { _id: record._id },
      { $set: { supplies: updatedSupplies } }
    );
    count++;
  }
  
  console.log(`Updated ${count} records with true blockchain supply.`);
  await client.close();
  process.exit(0);
}

run();
