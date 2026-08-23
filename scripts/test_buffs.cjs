const { initDB } = require('./src-backend/config/db.cjs');

async function test() {
    let baseReward = 0.4;
    let sflOrder = { items: { "Sunflower Cake": 1 } };
    let data = {
        farm: {
            bumpkin: {
                skills: { "Nom Nom": 1690000000000 },
                equipped: { "coat": "Chef Apron" }
            }
        }
    };
    
    const foodRecipes = require('./src/data/foodRecipes.json');
    let revenueMultiplier = 1;
    const skills = data.farm?.bumpkin?.skills || {};
    const wardrobe = data.farm?.bumpkin?.equipped || {};
    
    let isFood = false;
    let isBakery = false;
    for (const itemName of Object.keys(sflOrder.items || {})) {
        if (foodRecipes[itemName]) {
            isFood = true;
            if (foodRecipes[itemName].building === 'Bakery') {
                isBakery = true;
            }
        }
    }
    
    if (isFood && skills["Nom Nom"]) {
        const rank = skills["Nom Nom"];
        let buff = 0;
        if (rank === 1) buff = 10;
        else if (rank === 2) buff = 15;
        else if (rank >= 3) buff = 20;
        revenueMultiplier *= (1 + buff / 100);
    }
    
    if (isBakery) {
        const equippedItems = Object.values(wardrobe);
        if (equippedItems.includes("Chef Apron")) revenueMultiplier *= 1.2;
        if (equippedItems.includes("Chef Hat")) revenueMultiplier *= 1.1;
    }
    
    let rewardAmount = baseReward * revenueMultiplier;
    rewardAmount = Math.round(rewardAmount * 10000) / 10000;
    
    console.log(`Original: ${baseReward}`);
    console.log(`Buffed: ${rewardAmount}`);
    console.log(`Expected: 0.4 * 1.2 (NomNom) * 1.2 (Apron) = ${0.4 * 1.2 * 1.2}`);
    
}
test();
