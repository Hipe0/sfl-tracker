const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Deliveries - Hardcode ticket numbers without extra buffs
// The target looks like:
// } else {
//   rewardType = 'Shiny Feather';
//   exactRewardStr = `${rewardAmount} Shiny Feather`;
// }
code = code.replace(/rewardType = 'Shiny Feather';\s*exactRewardStr = `\$\{rewardAmount\} Shiny Feather`;/g, 
`rewardType = 'Shiny Feather';
                 const fixedFeathers = { "pumpkin' pete": 6, "bert": 7, "miranda": 7, "finley": 7, "raven": 9, "finn": 10, "timmy": 10, "cornwell": 8, "jester": 9, "pharaoh": 11, "tywin": 15 };
                 if (fixedFeathers[npcName.toLowerCase()]) {
                     rewardAmount = fixedFeathers[npcName.toLowerCase()];
                 }
                 exactRewardStr = \`\${rewardAmount} Shiny Feather\`;`);

// 2. Deliveries - Fix item parsing Pumpkin15 -> Pumpkin
code = code.replace(/const itemName = \$[cC]\(bEl\)\.find\('div'\)\.first\(\)\.text\(\)\.trim\(\) \|\| \$[cC]\(bEl\)\.text\(\)\.trim\(\)\.split\('\\n'\)\[0\]\.trim\(\);/g,
`const itemNameMatch = $c(bEl).text().trim().match(/^[a-zA-Z\\s'-]+/);
              const itemName = itemNameMatch ? itemNameMatch[0].trim() : ($c(bEl).find('div').first().text().trim() || $c(bEl).text().trim().split('\\n')[0].trim());`);

// 3. Bounties API extraction
const searchBounties = /if \(selectedReq\.items && Object\.keys\(selectedReq\.items\)\.length > 0\) \{[\s\S]*?rewardType = Object\.keys\(selectedReq\.items\)\[0\];\s*\} else if \(selectedReq\.coins > 0\) \{[\s\S]*?rewardType = 'Coins';\s*\}/g;
const replaceBounties = `if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    rewardType = Object.keys(selectedReq.items)[0];
                    reward = selectedReq.items[rewardType];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
                    reward = selectedReq.coins;
                 }
                 
                 if (rewardType === 'Shiny Feather' && summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                     reward += 100;
                 }`;
code = code.replace(searchBounties, replaceBounties);

const searchBountiesMatch = /const bReqs = gameData\.bounties\.requests\.filter\(r => r\.name\.toLowerCase\(\) === choreText\.toLowerCase\(\)\);/g;
const replaceBountiesMatch = `const bReqs = gameData.bounties.requests.filter(r => choreText.toLowerCase().includes(r.name.toLowerCase()));`;
code = code.replace(searchBountiesMatch, replaceBountiesMatch);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Regex replacements applied!');
