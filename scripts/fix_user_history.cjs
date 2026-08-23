require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
const fs = require('fs');

async function fixHistory() {
    await initDB();
    const historyCol = getHistoryCollection();
    
    // We will use the existing api_response.json to get the buffs for the main farm
    const data = JSON.parse(fs.readFileSync('api_response.json', 'utf8'));
    const gameData = data.data.gameData;
    const skills = gameData.bumpkin?.skills || {};
    
    const wardrobe = {};
    if (gameData.bumpkin?.equipped) {
        Object.values(gameData.bumpkin.equipped).forEach(item => {
            if (item) wardrobe[item] = (wardrobe[item] || 0) + 1;
        });
    }
    if (gameData.farmHands?.bumpkins) {
        Object.values(gameData.farmHands.bumpkins).forEach(hand => {
            if (hand.equipped) {
                Object.values(hand.equipped).forEach(item => {
                    if (item) wardrobe[item] = (wardrobe[item] || 0) + 1;
                });
            }
        });
    }
    
    const farmId = '6279470157500012';
    const farm = await historyCol.findOne({ _id: farmId });
    if (!farm) {
        console.log(`Farm ${farmId} not found in history.`);
        process.exit(1);
    }
    
    let deliveries = Array.isArray(farm.deliveries) ? [...farm.deliveries] : [];
    if (!Array.isArray(farm.deliveries)) {
        if (farm.deliveries && typeof farm.deliveries === 'object') {
            deliveries = Object.values(farm.deliveries);
        }
    }
    
    let modified = false;
    for (let i = 0; i < deliveries.length; i++) {
        const d = deliveries[i];
        if (d.rewardType === 'coins' && d.baseReward !== undefined) {
            let revenueMultiplier = 1;
            const npcName = d.npcName ? d.npcName.toLowerCase() : '';
            const reqItemKeys = d.reqItems ? Object.keys(d.reqItems) : [];
            
            if (npcName === "betty" && skills["Betty's Friend"]) {
                const rank = skills["Betty's Friend"];
                if (rank === 1) revenueMultiplier *= 1.3;
                else if (rank === 2) revenueMultiplier *= 1.45;
                else if (rank >= 3) revenueMultiplier *= 1.6;
            }
            if (npcName === "victoria" && skills["Victoria's Secretary"]) {
                const rank = skills["Victoria's Secretary"];
                if (rank === 1) revenueMultiplier *= 1.5;
                else if (rank === 2) revenueMultiplier *= 1.75;
                else if (rank >= 3) revenueMultiplier *= 2.0;
            }
            if (npcName === "corale" && skills["Fishy Fortune"]) {
                const rank = skills["Fishy Fortune"];
                if (rank === 1) revenueMultiplier *= 2.0;
                else if (rank === 2) revenueMultiplier *= 2.25;
                else if (rank >= 3) revenueMultiplier *= 2.5;
            }
            if (npcName === "blacksmith" && skills["Forge-Ward Profits"]) {
                const rank = skills["Forge-Ward Profits"];
                if (rank === 1) revenueMultiplier *= 1.2;
                else if (rank === 2) revenueMultiplier *= 1.3;
                else if (rank >= 3) revenueMultiplier *= 1.4;
            }
            if (npcName === "tango" && skills["Fruity Profit"]) {
                const rank = skills["Fruity Profit"];
                if (rank === 1) revenueMultiplier *= 1.5;
                else if (rank === 2) revenueMultiplier *= 1.75;
                else if (rank >= 3) revenueMultiplier *= 2.0;
            }
            
            const foodRecipes = require('./src/data/foodRecipes.json');
            const isFoodItem = reqItemKeys.some(item => foodRecipes[item] !== undefined);
            const isCake = reqItemKeys.some(item => item.toLowerCase().includes('cake'));
            
            if (isFoodItem && skills["Nom Nom"]) {
                const rank = skills["Nom Nom"];
                if (rank === 1) revenueMultiplier *= 1.1;
                else if (rank === 2) revenueMultiplier *= 1.3;
                else if (rank >= 3) revenueMultiplier *= 1.5;
            }
            if (isCake && wardrobe["Chef Apron"]) {
                revenueMultiplier *= 1.2;
            }
            if (npcName === "bakery" && wardrobe["Chef Hat"]) {
                revenueMultiplier *= 1.1;
            }
            
            let newReward = Math.round(d.baseReward * revenueMultiplier * 10000) / 10000;
            if (npcName === "old salty") {
                newReward = d.baseReward; // No buffs for Old Salty
            }
            
            if (d.reward !== newReward) {
                console.log(`[${d.date}] ${d.npcName}: Reward updated from ${d.reward} -> ${newReward} (Base: ${d.baseReward}, Mult: ${revenueMultiplier})`);
                d.reward = newReward;
                modified = true;
            }
        }
    }
    
    if (modified) {
        await historyCol.updateOne({ _id: farmId }, { $set: { deliveries } });
        console.log(`Database updated successfully for ID ${farmId}.`);
    } else {
        console.log(`No updates were necessary for ID ${farmId}.`);
    }
    process.exit(0);
}

fixHistory();
