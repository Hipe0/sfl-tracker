const puppeteer = require('puppeteer');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const itemsToScrape = [
  "Wood", "Stone", "Iron", "Gold", 
  "Sunflower", "Potato", "Pumpkin", "Carrot", "Cabbage", "Beetroot", "Cauliflower", "Parsnip", "Radish", "Wheat",
  "Apple", "Blueberry", "Orange", "Egg", "Honey", "Milk"
];

const uri = process.env.MONGODB_URI;

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('sfl_tracker');
  const collection = db.collection('market_prices');

  console.log("Launching browser...");
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  for (const itemName of itemsToScrape) {
    console.log(`\nFetching ${itemName}...`);
    let csvUrl = '';
    
    // Set up request interceptor for this item
    const requestHandler = request => {
      const url = request.url();
      if (url.endsWith('.csv') && url.includes('/trade/csv/')) {
        csvUrl = url;
      }
    };
    
    page.on('request', requestHandler);

    try {
      await page.goto(`https://sfl.world/tools/trade/?name=${encodeURIComponent(itemName)}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(r => setTimeout(r, 2000)); // wait for api calls

      if (!csvUrl) {
        console.log(`Failed to find CSV URL for ${itemName}`);
      } else {
        console.log(`Found CSV: ${csvUrl}`);
        // Fetch the CSV content using the page context to bypass Cloudflare
        const csvContent = await page.evaluate(async (url) => {
          const res = await fetch(url);
          return await res.text();
        }, csvUrl);

        if (csvContent) {
          // Parse CSV
          const lines = csvContent.split('\n');
          let count = 0;
          const bulkOps = [];
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const parts = line.split(',');
            if (parts.length >= 2) {
              const timeStr = parts[0]; // e.g. 2026-06-22T09:00:00Z
              const price = parseFloat(parts[1]);
              
              if (!isNaN(price)) {
                const date = new Date(timeStr);
                const timestamp = date.getTime();
                
                bulkOps.push({
                  updateOne: {
                    filter: { _id: timestamp },
                    update: {
                      $set: {
                        timestamp: date,
                        [`prices.${itemName}`]: price
                      }
                    },
                    upsert: true
                  }
                });
                count++;
              }
            }
          }
          
          if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps, { ordered: false });
            console.log(`Successfully saved ${count} data points for ${itemName}`);
          }
        }
      }
    } catch (e) {
      console.error(`Error processing ${itemName}:`, e.message);
    } finally {
      page.off('request', requestHandler);
    }
  }

  await browser.close();
  await client.close();
  console.log("Done scraping real history!");
}

run();
