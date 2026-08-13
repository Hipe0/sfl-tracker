require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function recalculateHistory() {
    await initDB();
    const historyCol = getHistoryCollection();
    const farms = await historyCol.find({}).toArray();
    let totalUpdated = 0;
    const apiKey = process.env.SFL_API_KEY;
    
    if (!apiKey) {
        console.error("Missing SFL_API_KEY in .env");
        process.exit(1);
    }
    
    console.log(`Starting recalculation for ${farms.length} farms. Please wait...`);
    
    for (const farm of farms) {
        const farmId = farm._id;
        console.log(`Processing farm ${farmId}...`);
        
        let modified = false;
        let deliveries = Array.isArray(farm.deliveries) ? [...farm.deliveries] : [];
        if (!Array.isArray(farm.deliveries)) {
            if (farm.deliveries && typeof farm.deliveries === 'object') {
                deliveries = Object.values(farm.deliveries);
            }
        }
        
        let gameData = null;
        let success = false;
        let retryCount = 0;
        
        while (!success && retryCount < 5) {
            const response = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
                headers: {
                    'x-api-key': apiKey,
                    'Accept': 'application/json'
                }
            });
            
            if (response.status === 429) {
                console.log(`  - Rate limited (429) on ${farmId}. Waiting 15 seconds before retrying...`);
                await new Promise(r => setTimeout(r, 15000));
                retryCount++;
                continue;
            }
            
            if (!response.ok) {
                console.log(`  - Failed to fetch API for ${farmId} (Status: ${response.status}), skipping.`);
                break;
            }
            
            const data = await response.json();
            gameData = data.farm; 
            success = true;
        }
        
        if (!gameData) {
            console.log(`  - No gameData found for ${farmId}, skipping.`);
            continue;
        }
        
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
        
        // Recalculate Coin deliveries
        for (let i = 0; i < deliveries.length; i++) {
            const d = deliveries[i];
            if ((d.rewardType === 'coins' || d.rewardType === 'sfl') && d.baseReward !== undefined) {
                let bonus = 0;
                const npcName = d.npcName ? d.npcName.toLowerCase() : '';
                const reqItemKeys = d.reqItems ? Object.keys(d.reqItems) : [];
                
                if (d.rewardType === 'coins') {
                    if (npcName === "betty" && skills["Betty's Friend"]) {
                        const rank = skills["Betty's Friend"];
                        if (rank === 1) bonus += 0.3;
                        else if (rank === 2) bonus += 0.45;
                        else if (rank >= 3) bonus += 0.6;
                    }
                    if (npcName === "victoria" && skills["Victoria's Secretary"]) {
                        const rank = skills["Victoria's Secretary"];
                        if (rank === 1) bonus += 0.5;
                        else if (rank === 2) bonus += 0.75;
                        else if (rank >= 3) bonus += 1.0;
                    }
                    if (npcName === "corale" && skills["Fishy Fortune"]) {
                        const rank = skills["Fishy Fortune"];
                        if (rank === 1) bonus += 1.0;
                        else if (rank === 2) bonus += 1.25;
                        else if (rank >= 3) bonus += 1.5;
                    }
                    if (npcName === "blacksmith" && skills["Forge-Ward Profits"]) {
                        const rank = skills["Forge-Ward Profits"];
                        if (rank === 1) bonus += 0.2;
                        else if (rank === 2) bonus += 0.3;
                        else if (rank >= 3) bonus += 0.4;
                    }
                    if (npcName === "tango" && skills["Fruity Profit"]) {
                        const rank = skills["Fruity Profit"];
                        if (rank === 1) bonus += 0.5;
                        else if (rank === 2) bonus += 0.75;
                        else if (rank >= 3) bonus += 1.0;
                    }
                }
                
                const foodRecipes = require('./src/data/foodRecipes.json');
                const isFoodItem = reqItemKeys.some(item => foodRecipes[item] !== undefined);
                const isCake = reqItemKeys.some(item => item.toLowerCase().includes('cake'));
                
                if (isFoodItem && skills["Nom Nom"]) {
                    const rank = skills["Nom Nom"];
                    if (rank === 1) bonus += 0.1;
                    else if (rank === 2) bonus += 0.3;
                    else if (rank >= 3) bonus += 0.5;
                }
                
                if (isCake && wardrobe["Chef Apron"]) {
                    bonus += 0.2;
                }
                
                if (npcName === "bakery" && wardrobe["Chef Hat"]) {
                    bonus += 0.1;
                }
                
                let revenueMultiplier = 1 + bonus;
                let newReward = Math.round(d.baseReward * revenueMultiplier * 10000) / 10000;
                if (npcName === "old salty") {
                    newReward = d.baseReward; // old salty has no buff
                }
                
                if (d.reward !== newReward) {
                    console.log(`    - Updating ${d.npcName} delivery: ${d.reward} -> ${newReward}`);
                    d.reward = newReward;
                    modified = true;
                }
            }
        }
        
        if (modified) {
            await historyCol.updateOne({ _id: farmId }, { $set: { deliveries } });
            console.log(`  -> Updated history for farm ${farmId}`);
            totalUpdated++;
        }
        
        // Wait 2000ms (2 seconds) between each API call to respect rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log(`Recalculation complete. Total farms updated: ${totalUpdated}`);
    process.exit(0);
}

recalculateHistory();
