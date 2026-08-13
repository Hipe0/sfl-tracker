require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const foodRecipes = require('./src/data/foodRecipes.json');

async function fixHistory() {
    await initDB();
    const historyCol = getHistoryCollection();
    
    const farmId = "6279470157500012";
    const history = await historyCol.findOne({ _id: farmId });
    
    if (!history || !history.deliveries) {
        console.log("No history or deliveries found for user.");
        process.exit(1);
    }
    
    // Fetch live gameData to get exact skills/wardrobe
    const communityRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`);
    const resData = await communityRes.json();
    const gameData = resData.farm;
    
    const skills = gameData?.bumpkin?.skills || {};
    const equippedItems = [];
    if (gameData?.bumpkin?.equipped) {
        equippedItems.push(...Object.values(gameData.bumpkin.equipped));
    }
    if (gameData?.farmHands?.bumpkins) {
        for (const hand of Object.values(gameData.farmHands.bumpkins)) {
            if (hand.equipped) {
                equippedItems.push(...Object.values(hand.equipped));
            }
        }
    }
    
    let modified = false;
    const dates = Object.keys(history.deliveries);
    for (const date of dates) {
        const deliveries = history.deliveries[date];
        for (const d of deliveries) {
            // Check if it's a food delivery
            let isFood = false;
            let isBakery = false;
            let isCake = false;
            if (d.reqItems) {
                for (const item of d.reqItems) {
                    if (foodRecipes[item.name]) {
                        isFood = true;
                        if (foodRecipes[item.name].building === 'Bakery') isBakery = true;
                        if (item.name.toLowerCase().includes("cake")) isCake = true;
                    }
                }
            }
            
            if (isFood) {
                let revenueMultiplier = 1;
                
                // Force Nom Nom (+50% for all food)
                revenueMultiplier *= 1.5;
                
                // Force Chef Apron (+20% for all cakes)
                if (isCake) {
                    revenueMultiplier *= 1.2;
                }
                // Force Chef Hat (+10% for all bakery items)
                if (isBakery) {
                    revenueMultiplier *= 1.1;
                }
                
                if (revenueMultiplier > 1) {
                    let origReward = d.reward;
                    let newReward = Math.round(origReward * revenueMultiplier * 10000) / 10000;
                    console.log(`[${date}] ${d.npcName} (${d.reqItems.map(i=>i.name).join(',')}): ${origReward} -> ${newReward} (mult: ${revenueMultiplier})`);
                    d.reward = newReward;
                    modified = true;
                }
            }
        }
    }
    
    if (modified) {
        await historyCol.updateOne({ _id: farmId }, { $set: { deliveries: history.deliveries } });
        console.log("Database updated successfully.");
    } else {
        console.log("No updates needed or dry run skipped.");
    }
    
    process.exit(0);
}

fixHistory().catch(console.error);
