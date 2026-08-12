require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const historyCol = db.collection('history');
    
    const farmId = '8052347903218326';
    
    const history = await historyCol.findOne({ _id: farmId });
    if (!history) {
        console.log("No history found");
        return;
    }
    
    if (history.bounties_completed) {
        // Simple hardcoded map of some basic prices so we don't have to fetch them
        const p2pPrices = {
            'Wood': 0.012,
            'Stone': 0.035,
            'Iron': 0.075,
            'Gold': 0.44,
            'Crimstone': 0.65,
            'Potato': 0.003,
            'Sunflower': 0.002,
            'Pumpkin': 0.004,
            'Carrot': 0.008,
            'Cabbage': 0.015,
            'Beetroot': 0.02,
            'Cauliflower': 0.03,
            'Parsnip': 0.04,
            'Radish': 0.06,
            'Wheat': 0.05,
            'Kale': 0.07,
            'Apple': 0.15,
            'Orange': 0.18,
            'Blueberry': 0.12,
            'Banana': 0.15,
            'Grape': 0.35,
            'Lemon': 0.35,
            'Tomato': 0.035,
            'Eggplant': 0.045,
            'Corn': 0.055,
            'Radish': 0.06,
            'Onion': 0.08,
            'Turnip': 0.09,
            'Red Pansy': 0.06,
            'Yellow Pansy': 0.06,
            'Purple Pansy': 0.06,
            'White Pansy': 0.06,
            'Blue Pansy': 0.06,
            'Red Cosmos': 0.07,
            'Yellow Cosmos': 0.07,
            'Purple Cosmos': 0.07,
            'White Cosmos': 0.07,
            'Blue Cosmos': 0.07,
            'Red Balloon Flower': 0.08,
            'Yellow Balloon Flower': 0.08,
            'Purple Balloon Flower': 0.08,
            'White Balloon Flower': 0.08,
            'Blue Balloon Flower': 0.08,
            'Red Carnation': 0.09,
            'Yellow Carnation': 0.09,
            'Purple Carnation': 0.09,
            'White Carnation': 0.09,
            'Blue Carnation': 0.09,
            'Sunpetal': 0.05,
            'Bloom': 0.06,
            'Lily': 0.08,
            'Honey': 0.1,
            'Egg': 0.05,
            'Milk': 0.1,
            'Feather': 0.01,
            'Leather': 0.15,
            'Wool': 0.05,
            'Merino Wool': 0.15,
            'Crimson Fleece': 0.3,
            'Anchovy': 0.05,
            'Tuna': 0.1,
            'Squid': 0.1,
            'Red Snapper': 0.15,
            'Old Snapper': 0.15,
            'Shrimp': 0.2,
            'Kraken Tentacle': 0.3,
            'Seaweed': 0.1,
            'Crab': 0.15,
            'Barnacle': 0.2,
            'Pipi': 0.3,
            'Mashed Potato': 0.05,
            'Pumpkin Soup': 0.08,
            'Bumpkin Broth': 0.1,
            'Popcorn': 0.1,
            'Cauliflower Burger': 0.2,
            'Club Sandwich': 0.3,
            'Roast Veggies': 0.4,
            'Apple Pie': 0.5,
            'Orange Cake': 0.6,
            'Blueberry Jam': 0.4,
            'Honey Cake': 0.6,
            'Kale & Mushroom Pie': 0.7,
            'Mushroom Jacket Potatoes': 0.8,
            'Fish Stick': 0.2,
            'Surimi Rice Bowl': 0.3,
            'Fried Calamari': 0.4,
            'Steamed Red Rice': 0.5,
            'Sushi Roll': 0.6,
            "Ocean's Olive": 0.7,
            'Kraken Hash': 0.8,
            'Bumpkin Salad': 0.5,
            "Goblin's Treat": 1.0,
            'Fermented Fish': 0.3,
            'Chowder': 0.5,
            'Gumbo': 0.7,
            'Boiled Eggs': 0.1,
            'Cake': 1.5,
            'Pancakes': 0.8,
            'Sauerkraut': 0.5,
            'Mushroom Soup': 0.4,
            'Rhubarb Tart': 0.6,
            'Cheese': 0.3,
            'Caprese Salad': 0.4,
            'Pizza Margherita': 0.6
        };

        let updated = false;
        
        Object.keys(history.bounties_completed).forEach(key => {
            const b = history.bounties_completed[key];
            if (!b.cost || b.cost === 0) {
                let itemName = b.originalName;
                let itemMultiplier = 1;
                
                // Parse name like "Sell 10 Potato"
                const nameMatch = itemName.match(/(?:Sell|Cook|Chop|Mine|Harvest|Pick|Grow|Craft)\s+(\d+)?\s*([A-Za-z\s'-]+)/i);
                if (nameMatch) {
                    if (nameMatch[1]) itemMultiplier = parseInt(nameMatch[1], 10);
                    itemName = nameMatch[2].trim();
                    if (itemName.toLowerCase().endsWith(' times')) itemName = itemName.slice(0, -6).trim();
                }
                
                // Try to find exact or singular
                let pPrice = p2pPrices[itemName];
                if (pPrice === undefined) {
                    let cropNameRaw = itemName.toLowerCase();
                    if (cropNameRaw.endsWith('s')) cropNameRaw = cropNameRaw.slice(0, -1);
                    const capitalized = cropNameRaw.charAt(0).toUpperCase() + cropNameRaw.slice(1);
                    pPrice = p2pPrices[capitalized];
                }
                
                if (pPrice !== undefined) {
                    // Approximate total based on multiplier if total was 1
                    let effectiveTotal = itemMultiplier;
                    
                    b.cost = Number((pPrice * effectiveTotal).toFixed(5));
                    updated = true;
                    console.log(`Updated cost for ${b.originalName} to ${b.cost} SFL`);
                } else {
                    console.log(`Could not find price for ${itemName} (from ${b.originalName})`);
                }
            }
        });
        
        if (updated) {
            await historyCol.updateOne({ _id: farmId }, { $set: { bounties_completed: history.bounties_completed } });
            console.log("Database updated successfully.");
        } else {
            console.log("No bounties needed updating.");
        }
    }
    
  } catch(e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
