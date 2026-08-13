const foodRecipes = require('./src/data/foodRecipes.json');

async function checkCoinTasks() {
    const farmId = "6279470157500012";
    console.log(`Fetching data for ${farmId}...`);
    
    try {
        const fs = require('fs');
        const data = JSON.parse(fs.readFileSync('api_response.json', 'utf8'));
        const gameData = data.data.gameData;
        
        if (!gameData || !gameData.delivery || !gameData.delivery.orders) {
            console.log("No orders found.");
            return;
        }

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
        
        console.log("--- COIN TASKS ---");
        const orders = gameData.delivery.orders;
        for (const order of orders) {
            if (order.reward && order.reward.coins > 0) {
                const baseCoins = order.reward.coins;
                let revMult = 1;
                
                let isFood = false;
                let isCake = false;
                const items = Object.keys(order.items || {});
                for (const item of items) {
                    if (foodRecipes[item]) {
                        isFood = true;
                        if (item.toLowerCase().includes("cake")) isCake = true;
                    }
                }
                
                if (isFood && skills["Nom Nom"]) {
                    const rank = skills["Nom Nom"];
                    if (rank === 1) revMult *= 1.1;
                    else if (rank === 2) revMult *= 1.3;
                    else if (rank >= 3) revMult *= 1.5;
                }
                if (isCake && equippedItems.includes("Chef Apron")) {
                    revMult *= 1.2;
                }
                // Chef Hat (+10%) was not part of the standard requirement for all cakes, 
                // but let's just see if they have it.
                let isBakery = false;
                for (const item of items) {
                     if (foodRecipes[item] && foodRecipes[item].building === 'Bakery') isBakery = true;
                }
                if (isBakery && equippedItems.includes("Chef Hat")) {
                    revMult *= 1.1;
                }
                
                const finalCoins = Math.round(baseCoins * revMult * 10000) / 10000;
                
                const itemsStr = Object.entries(order.items).map(([k,v]) => `${v} ${k}`).join(', ');
                let buffStr = revMult > 1 ? ` (Base: ${baseCoins}, Buff: ${revMult}x)` : '';
                console.log(`NPC: ${order.from}`);
                console.log(`Requires: ${itemsStr}`);
                console.log(`Reward: ${finalCoins} Coins${buffStr}`);
                console.log(`-----------------`);
            }
        }
        
    } catch (e) {
        console.error(e);
    }
}

checkCoinTasks();
