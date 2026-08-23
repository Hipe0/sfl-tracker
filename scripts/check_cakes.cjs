require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const foodRecipes = require('./src/data/foodRecipes.json');

async function run() {
    await initDB();
    const historyCol = getHistoryCollection();
    
    // Get start of 3 days ago
    const date = new Date();
    date.setDate(date.getDate() - 3);
    
    console.log(`Checking deliveries since ${date.toISOString()}...`);
    
    const histories = await historyCol.find({
        timestamp: { $gte: date }
    }).toArray();
    
    console.log(`Found ${histories.length} history records in the last 3 days.`);
    
    const affectedFarms = new Set();
    let affectedDeliveries = 0;
    
    for (const history of histories) {
        if (!history.coinDeliveries || history.coinDeliveries.length === 0) continue;
        
        let hasCake = false;
        for (const delivery of history.coinDeliveries) {
            if (delivery.reqItems) {
                for (const item of delivery.reqItems) {
                    if (foodRecipes[item.name] && foodRecipes[item.name].building === 'Bakery') {
                        hasCake = true;
                        affectedFarms.add(history.farmId);
                        affectedDeliveries++;
                        console.log(`Farm ${history.farmId} delivered ${item.name}. Reward saved: ${delivery.rewardAmount}`);
                        break; // Only count the delivery once
                    }
                }
            }
        }
    }
    
    console.log(`Total affected farms: ${affectedFarms.size}`);
    console.log(`Total affected deliveries: ${affectedDeliveries}`);
    process.exit(0);
}

run().catch(console.error);
