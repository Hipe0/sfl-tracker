const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Remove VIP and Clothes Buff from Deliveries
const s1 = `                  // Keep previous algorithms: VIP and Clothes buffs for deliveries
                  if (inventory.hasVip) rewardAmount += 2;
                  let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                  rewardAmount += ticketClothesBuff;`;
code = code.replace(s1, '');

const s2 = `                 // Keep previous algorithms: VIP and Clothes buffs for deliveries
                 if (inventory.hasVip) rewardAmount += 2;
                 let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                 rewardAmount += ticketClothesBuff;`;
code = code.replace(s2, '');

// 2. Restore Animal Cow and Sheep Buff
const sAnimal = `            if (rewardType === 'Shiny Feather') {
                const isCompleted = completedBounties.includes(req.id);`;
const rAnimal = `            if (rewardType === 'Shiny Feather') {
                if (req.name.toLowerCase().includes('cow') || req.name.toLowerCase().includes('sheep')) {
                    let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                    rewardAmount += ticketClothesBuff;
                }
                const isCompleted = completedBounties.includes(req.id);`;
code = code.replace(sAnimal, rAnimal);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Fixed manually');
