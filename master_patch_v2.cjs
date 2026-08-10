const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Fix Badge Parsing for "Delivery for Coins / Flower" (Lines 400+)
const coinDeliveryTarget = `            const reqItems = [];
            itemsTd.find('.badge').each((k, bEl) => {
              const itemName = $l(bEl).find('div').first().text().trim() || $l(bEl).text().trim().split('\\n')[0].trim();
              const bEl2 = $l(bEl).find('b');
              const total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
              const imgEl = $l(bEl).find('img').first();
              const imgSrc = imgEl.length > 0 ? imgEl.attr('src') : null;`;

const coinDeliveryReplacement = `            const reqItems = [];
            itemsTd.find('.badge').each((k, bEl) => {
              const itemNameMatch = $l(bEl).text().trim().match(/^[a-zA-Z\\s'-]+/);
              const itemName = itemNameMatch ? itemNameMatch[0].trim() : ($l(bEl).find('div').first().text().trim());
              const bEl2 = $l(bEl).find('b');
              
              let total = 0;
              if (bEl2.length > 0) {
                 total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
              }
              if (total === 0 && $l(bEl).find('.bi-check2-circle').length > 0) {
                 total = parseInt($l(bEl).text().replace(/[^0-9]/g, '')) || 0;
              }
              
              const imgEl = $l(bEl).find('img').first();
              const imgSrc = imgEl.length > 0 ? imgEl.attr('src') : null;`;

code = code.replace(coinDeliveryTarget, coinDeliveryReplacement);

// 2. Fix Badge Parsing for "Delivery for Tickets" (Lines 560+)
const ticketDeliveryTarget = `            const itemsTd = trEl.find('td').eq(1);
            const reqItems = [];
            itemsTd.find('.badge').each((k, bEl) => {
              const itemName = $c(bEl).find('div').first().text().trim();
              const smallEl = $c(bEl).find('small');
              const bEl2 = $c(bEl).find('b');
              
              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              }
              if (itemName && total > 0) {
                reqItems.push({ name: itemName, completed, total, enough });
              } else {
                const fallback = $c(bEl).text().trim().replace(/\\s+/g, ' ');
                reqItems.push({ name: fallback, completed: 0, total: 0, enough: true });
              }
            });`;

const ticketDeliveryReplacement = `            const itemsTd = trEl.find('td').eq(1);
            const reqItems = [];
            itemsTd.find('.badge').each((k, bEl) => {
              const itemNameMatch = $c(bEl).text().trim().match(/^[a-zA-Z\\s'-]+/);
              const itemName = itemNameMatch ? itemNameMatch[0].trim() : ($c(bEl).find('div').first().text().trim());
              const smallEl = $c(bEl).find('small');
              const bEl2 = $c(bEl).find('b');
              
              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              } else if ($c(bEl).find('.bi-check2-circle').length > 0) {
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                if (total === 0) total = parseInt($c(bEl).text().replace(/[^0-9]/g, '')) || 0;
                completed = total;
                enough = true;
              }
              
              if (itemName) {
                reqItems.push({ name: itemName, completed, total, enough });
              } else {
                const fallback = $c(bEl).text().trim().replace(/\\s+/g, ' ');
                reqItems.push({ name: fallback, completed, total, enough: true });
              }
            });`;

code = code.replace(ticketDeliveryTarget, ticketDeliveryReplacement);

// 3. Fix Weekly Chores API extraction matching (Line 705+)
const choresApiTarget = `              sflChore = choresList.find(c => {
                 if (c.name.toLowerCase() === choreText.toLowerCase()) return true;
                 const cNum = parseInt(c.name.match(/\\d+/)?.[0] || '0');
                 if (cNum !== choreNum && choreNum > 0) return false;
                 
                 const words2 = c.name.toLowerCase().split(/\\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');
                 return words1.some(w => words2.includes(w)) || (words1.length === 0 && words2.length === 0);
              });`;

const choresApiReplacement = `              sflChore = choresList.find(c => {
                 if (c.name.toLowerCase().includes(choreText.toLowerCase()) || choreText.toLowerCase().includes(c.name.toLowerCase())) return true;
                 const cNum = parseInt(c.name.match(/\\d+/)?.[0] || '0');
                 if (cNum !== choreNum && choreNum > 0) return false;
                 
                 const words2 = c.name.toLowerCase().split(/\\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');
                 return words1.some(w => words2.includes(w)) || (words1.length === 0 && words2.length === 0);
              });`;

code = code.replace(choresApiTarget, choresApiReplacement);

// 4. Fix Weekly Chores Bonus (Clothes/VIP)
const choresBonusTarget = `            if (sflChore) {
              console.log("MATCHED:", choreText, "->", sflChore.name, "Reward:", sflChore.reward);
              if (sflChore.reward.items && Object.keys(sflChore.reward.items).length > 0) {
                const itemName = Object.keys(sflChore.reward.items)[0];
                rewardAmount = sflChore.reward.items[itemName];
                rewardType = itemName;
              } else if (sflChore.reward.coins > 0) {
                rewardAmount = sflChore.reward.coins;
                rewardType = 'Coins';
              }
            } else {`;

const choresBonusReplacement = `            if (sflChore) {
              console.log("MATCHED:", choreText, "->", sflChore.name, "Reward:", sflChore.reward);
              if (sflChore.reward.items && Object.keys(sflChore.reward.items).length > 0) {
                const itemName = Object.keys(sflChore.reward.items)[0];
                rewardAmount = sflChore.reward.items[itemName];
                rewardType = itemName;
              } else if (sflChore.reward.coins > 0) {
                rewardAmount = sflChore.reward.coins;
                rewardType = 'Coins';
              }
              
              if (rewardType === 'Shiny Feather') {
                  let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                  rewardAmount += ticketClothesBuff;
                  if (inventory.hasVip) rewardAmount += 2;
                  
                  if (summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                      rewardAmount += 100;
                  }
              }
            } else {`;

code = code.replace(choresBonusTarget, choresBonusReplacement);

// 5. Fix Bounties matching
const bountiesTarget = `               const bReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase() === choreText.toLowerCase());`;
const bountiesReplacement = `               const bReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase().includes(choreText.toLowerCase()) || choreText.toLowerCase().includes(r.name.toLowerCase()));`;
code = code.replace(bountiesTarget, bountiesReplacement);

// 6. Fix Bounties Bonus (Clothes/VIP)
const bountiesBonusTarget = `                  if (rightDiv && rightDiv.html()) {
                    const htmlStr = rightDiv.html();
                    if (htmlStr.includes('tickets/')) rewardType = 'Shiny Feather';
                    else if (htmlStr.includes('Gem.png') || htmlStr.toLowerCase().includes('gem')) rewardType = 'Gem';
                    else rewardType = 'Coins';
                  }
               }
            } else {
               if (rightDiv && rightDiv.html()) {
                 const htmlStr = rightDiv.html();
                 if (htmlStr.includes('tickets/')) rewardType = 'Shiny Feather';
                 else if (htmlStr.includes('Gem.png') || htmlStr.toLowerCase().includes('gem')) rewardType = 'Gem';
                 else rewardType = 'Coins';
               }
            }
          }`;

const bountiesBonusReplacement = `                  if (rightDiv && rightDiv.html()) {
                    const htmlStr = rightDiv.html();
                    if (htmlStr.includes('tickets/')) rewardType = 'Shiny Feather';
                    else if (htmlStr.includes('Gem.png') || htmlStr.toLowerCase().includes('gem')) rewardType = 'Gem';
                    else rewardType = 'Coins';
                  }
               }
            } else {
               if (rightDiv && rightDiv.html()) {
                 const htmlStr = rightDiv.html();
                 if (htmlStr.includes('tickets/')) rewardType = 'Shiny Feather';
                 else if (htmlStr.includes('Gem.png') || htmlStr.toLowerCase().includes('gem')) rewardType = 'Gem';
                 else rewardType = 'Coins';
               }
            }
            
            if (rewardType === 'Shiny Feather') {
                let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                reward += ticketClothesBuff;
                if (inventory.hasVip) reward += 2;
                
                if (summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                    reward += 100;
                }
            }
          }`;

code = code.replace(bountiesBonusTarget, bountiesBonusReplacement);

// 7. Fix Animals Bonus
const animalsTarget = `          if (req) {
            reward = req.reward.amount;
            if (req.reward.items) {
               rewardType = Object.keys(req.reward.items)[0];
               reward = req.reward.items[rewardType];
            }
            status = completedBounties.includes(req.id) ? 'claimed' : 'ready';
          }`;

const animalsReplacement = `          if (req) {
            reward = req.reward.amount;
            if (req.reward.items) {
               rewardType = Object.keys(req.reward.items)[0];
               reward = req.reward.items[rewardType];
            }
            
            if (rewardType === 'Shiny Feather') {
                let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                reward += ticketClothesBuff;
            }
            
            status = completedBounties.includes(req.id) ? 'claimed' : 'ready';
          }`;
code = code.replace(animalsTarget, animalsReplacement);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log("SUCCESSFULLY PATCHED ALL REGRESSIONS IN FARMROUTES.CJS");
