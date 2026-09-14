const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not defined.");
  process.exit(1);
}

// Current prices approximation for some items to base the random walk on
const basePrices = {
  "Wood": 0.0126,
  "Stone": 0.015,
  "Iron": 0.03,
  "Gold": 0.1,
  "Sunflower": 0.00019,
  "Potato": 0.00015,
  "Pumpkin": 0.0003,
  "Carrot": 0.0005,
  "Cabbage": 0.0008,
  "Beetroot": 0.0015,
  "Cauliflower": 0.002,
  "Parsnip": 0.003,
  "Radish": 0.005,
  "Wheat": 0.0025,
  "Apple": 0.02,
  "Blueberry": 0.015,
  "Orange": 0.018
};

async function seedMockData() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log("Connected to MongoDB.");
    const db = client.db('sfl_tracker');
    const collection = db.collection('market_prices');

    const now = Date.now();
    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
    const startTime = now - oneMonthMs;
    const intervalMs = 15 * 60 * 1000; // 15 minutes per tick

    const docs = [];
    
    // Create random walk price trackers for each item
    let currentPrices = { ...basePrices };
    
    console.log("Generating 30 days of mock data (15-min intervals)...");

    for (let time = startTime; time <= now; time += intervalMs) {
      const doc = {
        _id: time,
        timestamp: new Date(time),
        prices: {}
      };

      for (const [item, price] of Object.entries(currentPrices)) {
        // Random walk: +/- 1.5% max change per 15 min
        const changePercent = (Math.random() - 0.5) * 0.03; 
        let newPrice = price * (1 + changePercent);
        
        // Ensure price doesn't go negative or drop to 0
        if (newPrice < 0.00001) newPrice = 0.00001;

        doc.prices[item] = parseFloat(newPrice.toFixed(6));
        currentPrices[item] = newPrice;
      }
      
      docs.push(doc);
    }

    console.log(`Prepared ${docs.length} historical data points. Inserting...`);
    
    // Clear old mock data if needed, but here we just insert (ignoring duplicates if any)
    for (let i = 0; i < docs.length; i += 1000) {
      const batch = docs.slice(i, i + 1000);
      try {
        await collection.insertMany(batch, { ordered: false });
      } catch (e) {
        // Ignore duplicate key errors if some overlaps exist
      }
    }

    console.log("Mock data insertion complete!");

  } catch (error) {
    console.error("Error seeding mock data:", error);
  } finally {
    await client.close();
  }
}

seedMockData();
