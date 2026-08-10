const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Deliveries: Fix the hardcoded block to INCLUDE the buff algorithms
const searchDelivery = `                 if (fixedFeathers[npcName.toLowerCase()]) {
                     rewardAmount = fixedFeathers[npcName.toLowerCase()];
                 }
                 exactRewardStr = \`\${rewardAmount} Shiny Feather\`;`;

const replaceDelivery = `                 if (fixedFeathers[npcName.toLowerCase()]) {
                     rewardAmount = fixedFeathers[npcName.toLowerCase()];
                     
                     // Restore algorithms: VIP and Clothes buffs for deliveries
                     if (inventory.hasVip) rewardAmount += 2;
                     let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                     rewardAmount += ticketClothesBuff;
                 }
                 exactRewardStr = \`\${rewardAmount} Shiny Feather\`;`;

code = code.replace(searchDelivery, replaceDelivery);
code = code.replace(searchDelivery, replaceDelivery); // Run twice in case of duplicates (though there might only be one now)

// 2. Animals: Restore algorithms for Cows and Sheep (and all animals)
const searchAnimal = `                if (rewardType === 'Shiny Feather') {
                    if (req.name.toLowerCase().includes('cow') || req.name.toLowerCase().includes('sheep')) {
                        rewardAmount += 3;
                    }
                    const isCompleted = completedBounties.includes(req.id);`;

const replaceAnimal = `                if (rewardType === 'Shiny Feather') {
                    // Restore algorithms: Clothes buff for animals (Cows and Sheep especially needed this as API missed it)
                    if (req.name.toLowerCase().includes('cow') || req.name.toLowerCase().includes('sheep')) {
                        let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                        rewardAmount += ticketClothesBuff;
                    }
                    const isCompleted = completedBounties.includes(req.id);`;

code = code.replace(searchAnimal, replaceAnimal);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Restored algorithms in farmRoutes.cjs');
