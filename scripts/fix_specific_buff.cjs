require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const foodRecipes = require('./src/data/foodRecipes.json');

async function fixSpecificBuff() {
    await initDB();
    const historyCol = getHistoryCollection();
    const farmId = "6279470157500012";
    const history = await historyCol.findOne({ _id: farmId });
    
    if (!history) return;

    let modified = false;
    for (const date of Object.keys(history.deliveries)) {
        const deliveries = history.deliveries[date];
        for (const d of deliveries) {
            let isCake = false;
            if (d.reqItems) {
                for (const item of d.reqItems) {
                    if (foodRecipes[item.name] && item.name.toLowerCase().includes("cake")) {
                        isCake = true;
                    }
                }
            }
            
            // Apply ONLY Chef Apron to Cakes
            if (isCake) {
                let origReward = d.reward;
                // If the reward is exactly 0.4 (unbuffed), apply the 1.2x buff
                if (d.rewardType === 'SFL' && origReward === 0.4) {
                    d.reward = 0.48;
                    console.log(`Updated ${date} ${d.npcName} SFL reward from ${origReward} to ${d.reward}`);
                    modified = true;
                }
                // Also check other unbuffed cakes if any exist
                // If origReward is 0.8 SFL, it becomes 0.96
            }
        }
    }

    if (modified) {
        await historyCol.updateOne({ _id: farmId }, { $set: { deliveries: history.deliveries } });
        console.log("Database updated successfully with correct Chef Apron buff for Cakes.");
    } else {
        console.log("No cakes found that needed Chef Apron buffing.");
    }
    
    process.exit(0);
}

fixSpecificBuff().catch(console.error);
