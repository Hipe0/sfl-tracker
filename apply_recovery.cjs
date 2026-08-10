const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');
const originalCode = code;

// 1. Animals Push ID fix
const animalsPushTarget = `                  if (rewardType === 'Shiny Feather') {
                      let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                      reward += ticketClothesBuff;
                      animals.push({ animalName, level, reward, rewardType, status });
                  }`;
const animalsPushReplacement = `                  if (rewardType === 'Shiny Feather') {
                      let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                      reward += ticketClothesBuff;
                      animals.push({ animalName, level, reward, rewardType, status, id: req.id });
                  }`;
if (code.includes(animalsPushTarget)) code = code.replace(animalsPushTarget, animalsPushReplacement);
else code = code.replace(animalsPushTarget.replace(/\r\n/g, '\n'), animalsPushReplacement);

// 2. Animal Level Extraction fix
const levelTarget = `                  // Extract Level from name like 'Level 5 Cow'
                  const levelMatch = req.name.match(/Level\\s+(\\d+)/i);
                  const level = levelMatch ? \`Lv \${levelMatch[1]}\` : 'Lv ?';`;
const levelReplacement = `                  // Extract Level from req.level API property
                  const level = req.level ? \`Lv \${req.level}\` : 'Lv ?';`;
if (code.includes(levelTarget)) code = code.replace(levelTarget, levelReplacement);
else code = code.replace(levelTarget.replace(/\r\n/g, '\n'), levelReplacement);

// 3. Deliveries Ticket Classification fix
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

// 4. Chore Cost Mapping Fixes (Shovel, Flowers, Wheat for Eggs)
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

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Patched ' + (originalCode !== code ? 'successfully' : 'FAILED'));
