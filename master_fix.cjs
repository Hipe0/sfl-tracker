const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// Normalize newlines to LF for easy matching
code = code.replace(/\\r\\n/g, '\\n');

// 1. Deliveries - Hardcode ticket numbers without extra buffs
const searchDelivery = `               } else {
                 rewardType = 'Shiny Feather';
                 exactRewardStr = \`\${rewardAmount} Shiny Feather\`;
               }`;
const replaceDelivery = `               } else {
                 rewardType = 'Shiny Feather';
                 const fixedFeathers = { "pumpkin' pete": 6, "bert": 7, "miranda": 7, "finley": 7, "raven": 9, "finn": 10, "timmy": 10, "cornwell": 8, "jester": 9, "pharaoh": 11, "tywin": 15 };
                 if (fixedFeathers[npcName.toLowerCase()]) {
                     rewardAmount = fixedFeathers[npcName.toLowerCase()];
                 }
                 exactRewardStr = \`\${rewardAmount} Shiny Feather\`;
               }`;
code = code.replace(searchDelivery, replaceDelivery);
code = code.replace(searchDelivery, replaceDelivery);

// 2. Deliveries - Fix item parsing Pumpkin15 -> Pumpkin
const searchDeliveryItem = `              const itemName = $c(bEl).find('div').first().text().trim() || $c(bEl).text().trim().split('\\n')[0].trim();`;
const replaceDeliveryItem = `              const itemNameMatch = $c(bEl).text().trim().match(/^[a-zA-Z\\s'-]+/);
              const itemName = itemNameMatch ? itemNameMatch[0].trim() : ($c(bEl).find('div').first().text().trim() || $c(bEl).text().trim().split('\\n')[0].trim());`;
code = code.replace(searchDeliveryItem, replaceDeliveryItem);

// 3. Bounties API extraction
const searchBounties = `                 const selectedReq = matchingReq || bReqs[0];
                 if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    rewardType = Object.keys(selectedReq.items)[0];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
                 }
               } else {`;
const replaceBounties = `                 const selectedReq = matchingReq || bReqs[0];
                 if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    rewardType = Object.keys(selectedReq.items)[0];
                    reward = selectedReq.items[rewardType];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
                    reward = selectedReq.coins;
                 }
                 
                 if (rewardType === 'Shiny Feather' && summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                     reward += 100;
                 }
               } else {`;
code = code.replace(searchBounties, replaceBounties);

const searchBountiesMatch = `const bReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase() === choreText.toLowerCase());`;
const replaceBountiesMatch = `const bReqs = gameData.bounties.requests.filter(r => choreText.toLowerCase().includes(r.name.toLowerCase()));`;
code = code.replace(searchBountiesMatch, replaceBountiesMatch);

// We already restored animals API block so it's fine.

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Applied ALL fixes to farmRoutes.cjs');
