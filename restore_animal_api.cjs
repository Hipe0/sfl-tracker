const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

const animalApiLogic = `
    // Rewrite Animals using API directly (more accurate and has unique IDs)
    animals = [];
    if (gameData && gameData.bounties && gameData.bounties.requests) {
        let completedBounties = (gameData.bounties.completed || []).map(c => c.id);
        const animalReqs = gameData.bounties.requests.filter(r => r.name && (r.name.toLowerCase().includes('cow') || r.name.toLowerCase().includes('sheep') || r.name.toLowerCase().includes('chicken')));
        animalReqs.forEach(req => {
            let rewardType = 'Unknown';
            let rewardAmount = 0;
            if (req.reward && req.reward.items && Object.keys(req.reward.items).length > 0) {
                const keys = Object.keys(req.reward.items);
                rewardType = keys[0];
                rewardAmount = req.reward.items[rewardType];
            } else if (req.reward && req.reward.coins > 0) {
                rewardType = 'Coins';
                rewardAmount = req.reward.coins;
            } else if (req.reward && req.reward.sfl > 0) {
                rewardType = 'SFL';
                rewardAmount = req.reward.sfl;
            } else {
                rewardType = 'Shiny Feather';
            }
            
            if (rewardType === 'Shiny Feather') {
                let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                rewardAmount += ticketClothesBuff;
                
                const isCompleted = completedBounties.includes(req.id);
                animals.push({
                    id: req.id,
                    name: req.name,
                    animalName: req.name.split(' ')[0],
                    level: req.name.replace(req.name.split(' ')[0], '').trim(),
                    reward: rewardAmount,
                    rewardType: rewardType,
                    status: isCompleted ? 'claimed' : 'ready'
                });
            }
        });
    }

    // Merge Coin deliveries with Ticket deliveries to pass into recordFarmHistory`;

code = code.replace('    // Merge Coin deliveries with Ticket deliveries to pass into recordFarmHistory', animalApiLogic);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Restored Animal API block');
