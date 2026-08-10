const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Fix Delivery Item Parsing (Pumpkin15 -> Pumpkin)
const searchDeliveryItem = `              const itemName = $c(bEl).find('div').first().text().trim();`;
const replaceDeliveryItem = `              const itemNameMatch = $c(bEl).text().trim().match(/^[a-zA-Z\\s'-]+/);
              const itemName = itemNameMatch ? itemNameMatch[0].trim() : '';`;
code = code.replace(searchDeliveryItem, replaceDeliveryItem);

// 2. Fix Bounties (Weekly Chores) API parsing and Poppy Bonus
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
                 
                 // Restore algorithm: Poppy Bounty Bonus (+100 or whatever, wait user said 100 before, let me check the message: "phần Bounties bonus 100 vé chứ không phải 50 vé nữa")
                 // Oh wait! In the previous session they said 100 tickets!
                 if (rewardType === 'Shiny Feather' && summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                     reward += 100;
                 }
               } else {`;

code = code.replace(searchBounties, replaceBounties);

// Also we need to fix the fallback in case `bReqs.length === 0` where `rewardType` defaults to 'Coins'
// If it defaults to 'Coins', the bonus won't be applied. But if `bReqs` doesn't match, maybe we can match `r.name` partially.
const searchBountiesMatch = `const bReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase() === choreText.toLowerCase());`;
const replaceBountiesMatch = `const bReqs = gameData.bounties.requests.filter(r => choreText.toLowerCase().includes(r.name.toLowerCase()));`;
code = code.replace(searchBountiesMatch, replaceBountiesMatch);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Fixed Delivery Item Parsing and Bounties');
