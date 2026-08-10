const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');
const originalCode = code;

// 1. Deliveries Ticket Classification fix
const ticketTarget = `             if (sflOrder) {
                if (sflOrder.reward.coins > 0) {
                  rewardType = 'Coins';
                  rewardAmount = sflOrder.reward.coins;
                  exactRewardStr = \`\${rewardAmount} Coins\`;
                } else if (sflOrder.reward.sfl > 0) {
                  rewardAmount = sflOrder.reward.sfl;
                  rewardType = 'SFL';
                  exactRewardStr = \`\${rewardAmount} SFL\`;
                } else {
                  rewardType = 'Shiny Feather';
                  rewardAmount = fixedFeathers[npcName.toLowerCase()] || 0;
                  exactRewardStr = \`\${rewardAmount} Shiny Feather\`;
                }
             } else {
                if (isTicketReward) {
                  rewardType = 'Shiny Feather';
                  rewardAmount = fixedFeathers[npcName.toLowerCase()] || parseInt(reward.replace(/[^0-9]/g, '')) || 0;
                  exactRewardStr = \`\${rewardAmount} Shiny Feather\`;
                } else {
                  rewardType = 'Coins';
                  rewardAmount = parseInt(reward.replace(/[^0-9]/g, '')) || 0;
                  exactRewardStr = \`\${rewardAmount} Coins\`;
                }
             }`;
const ticketReplacement = `             let isTicketNpc = fixedFeathers.hasOwnProperty(npcName.toLowerCase());
             if (sflOrder) {
                if (sflOrder.reward.coins > 0) {
                  rewardType = 'Coins';
                  rewardAmount = sflOrder.reward.coins;
                  exactRewardStr = \`\${rewardAmount} Coins\`;
                } else if (sflOrder.reward.sfl > 0) {
                  rewardAmount = sflOrder.reward.sfl;
                  rewardType = 'SFL';
                  exactRewardStr = \`\${rewardAmount} SFL\`;
                } else {
                  rewardType = 'Shiny Feather';
                  rewardAmount = (sflOrder.reward.items && sflOrder.reward.items['Shiny Feather']) || fixedFeathers[npcName.toLowerCase()] || 0;
                  exactRewardStr = \`\${rewardAmount} Shiny Feather\`;
                }
             } else {
                if (isTicketReward || isTicketNpc) {
                  rewardType = 'Shiny Feather';
                  rewardAmount = fixedFeathers[npcName.toLowerCase()] || parseInt(reward.replace(/[^0-9]/g, '')) || 0;
                  exactRewardStr = \`\${rewardAmount} Shiny Feather\`;
                } else {
                  rewardType = 'Coins';
                  rewardAmount = parseInt(reward.replace(/[^0-9]/g, '')) || 0;
                  exactRewardStr = \`\${rewardAmount} Coins\`;
                }
             }`;
if (code.includes(ticketTarget)) code = code.replace(ticketTarget, ticketReplacement);
else code = code.replace(ticketTarget.replace(/\r\n/g, '\n'), ticketReplacement);

// 2. Chore Cost Mapping Fixes (Shovel, Flowers, Wheat for Eggs)
const choreTarget = `          } else if (item.name.match(/Mine\\s+\\d+\\s+Crimstone/i)) {
            foundKey = 'Gold Pickaxe';
            if (toolCosts['crimstone'] !== undefined) {
              choreCost = Number((toolCosts['crimstone'] * item.total).toFixed(5));
              hasCost = true;
            }
          }`;
const choreReplacement = `          } else if (item.name.match(/Mine\\s+\\d+\\s+Crimstone/i)) {
            foundKey = 'Gold Pickaxe';
            if (toolCosts['crimstone'] !== undefined) {
              choreCost = Number((toolCosts['crimstone'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Dig\\s+\\d+\\s+times/i)) {
            foundKey = 'Shovel';
            let shovelCost = (toolCosts['wood'] || 0) + (toolCosts['stone'] || 0) + (toolCosts['iron'] || 0);
            if (shovelCost > 0) {
              choreCost = Number((shovelCost * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Collect\\s+Eggs\\s+\\d+\\s+times/i)) {
            foundKey = 'Wheat';
            if (toolCosts['wheat'] && toolCosts['wheat'].cost !== undefined) {
              choreCost = Number((toolCosts['wheat'].cost * item.total).toFixed(5));
              hasCost = true;
            } else if (toolCosts['wheat'] !== undefined) {
              choreCost = Number(((toolCosts['wheat'] || 0) * item.total).toFixed(5)); // fallback
              hasCost = true;
            }
          }`;
if (code.includes(choreTarget)) code = code.replace(choreTarget, choreReplacement);
else code = code.replace(choreTarget.replace(/\r\n/g, '\n'), choreReplacement);

// 3. Animals Fix
const animalStart = code.indexOf('// 5. Animals');
const animalEndString = '        });\n      }\n    });\n\n    if (hasVipAccess) inventory.hasVip = true;';
const animalEnd = code.indexOf(animalEndString) + animalEndString.length;

if (animalStart !== -1 && animalEnd !== -1) {
  const newAnimalLogic = `// 5. Animals logic rewritten to use API
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
                // Extract Level from req.level API property
                const level = req.level ? \`Lv \${req.level}\` : 'Lv ?';
                
                animals.push({
                    id: req.id,
                    animalName: req.name.split(' ')[0],
                    level: level,
                    reward: rewardAmount,
                    rewardType: rewardType,
                    status: isCompleted ? 'claimed' : 'ready'
                });
            }
        });
    }
    }); // close the table block loop`;
  
  code = code.substring(0, animalStart) + newAnimalLogic + code.substring(animalEnd);
} else {
  console.log('Animal block not found!');
}

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Patched ' + (originalCode !== code ? 'successfully' : 'FAILED'));
