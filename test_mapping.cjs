const fs = require('fs');
const gameData = JSON.parse(fs.readFileSync('farm_user.json', 'utf8')).farm;
const inventory = gameData.inventory || {};
const p2pPrices = {};
const craftingCosts = {};
const toolCosts = {};
const animalNames = ['chicken', 'cow', 'sheep'];

let chores = [];
let bounties = [];
let animals = [];

const completedBounties = (gameData && gameData.bounties && gameData.bounties.completed) ? gameData.bounties.completed.map(c => c.id) : [];

try {
    // 2. Parse Chores
    if (gameData && gameData.choreBoard && gameData.choreBoard.chores) {
        const choresList = [];
        for (const [npc, chore] of Object.entries(gameData.choreBoard.chores)) {
            let rewardType = 'Unknown';
            let rewardAmount = 0;
            if (chore.reward && chore.reward.items) {
                rewardType = Object.keys(chore.reward.items)[0];
                rewardAmount = chore.reward.items[rewardType];
            }
            
            const choreName = chore.name || `Task from ${npc}`;
            let total = 1;
            const match = choreName.match(/\d+/);
            if (match) {
                total = parseInt(match[0], 10);
            }
            
            choresList.push({
                name: choreName,
                title: choreName,
                npcName: npc,
                reward: rewardAmount,
                rewardType: rewardType,
                status: chore.completedAt ? 'claimed' : 'not_ready',
                isCoinType: false,
                total: total,
                completed: chore.completedAt ? total : 0
            });
        }
        chores.push({ category: 'This Week', items: choresList });
    }

    // 3. Parse Bounties & Animals
    if (gameData && gameData.bounties && gameData.bounties.requests) {
        for (const req of gameData.bounties.requests) {
            let rewardType = 'Unknown';
            let rewardAmount = 0;
            
            if (req.items) {
                rewardType = Object.keys(req.items)[0];
                rewardAmount = req.items[rewardType];
            } else if (req.coins) {
                rewardType = 'Coins';
                rewardAmount = req.coins;
            }
            
            const isCompleted = completedBounties.includes(req.id);
            const nameLower = (req.name || '').toLowerCase();
            const isAnimal = animalNames.some(a => nameLower.includes(a));
            
            let status = isCompleted ? 'claimed' : 'not_ready';
            let completed = isCompleted ? 1 : 0;
            if (!isCompleted && inventory && inventory[req.name] >= 1 && !isAnimal) {
                status = 'ready';
                completed = 1;
            }
            
            const taskObj = {
                name: req.name,
                animalName: req.name,
                level: req.level ? `Lvl ${req.level}+` : 'Lvl 1+',
                reward: rewardAmount,
                rewardType: rewardType,
                status: status,
                total: 1,
                completed: completed
            };
            
            if (isAnimal) {
                animals.push(taskObj);
            } else {
                bounties.push(taskObj);
            }
        }
    }

    const craftingKeys = Object.keys(craftingCosts).sort((a, b) => b.length - a.length);

    // Map chore costs
    chores = chores.map(category => {
      return {
        ...category,
        items: category.items.map(item => {
          let choreCost = 0;
          let foundKey = null;
          let hasCost = false;

          // Check if it's a tool-based task (Crafting Rods or Chopping/Mining)
          if (item.name.match(/Craft\s+\d+\s+Fishing Rods/i)) {
            foundKey = 'Fishing Rod';
          }
          return item;
        })
      };
    });

    console.log("Success!");
    console.log("Chores count:", chores[0]?.items?.length);
    console.log("Bounties count:", bounties.length);
    console.log("Animals count:", animals.length);

} catch(err) {
    console.error("ERROR OCCURRED:");
    console.error(err);
}
