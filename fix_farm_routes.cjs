const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

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

const searchDelivery2 = `               } else {
                 rewardType = 'Shiny Feather';
                 exactRewardStr = \`\${rewardAmount} Shiny Feather\`;
               }`;

code = code.replace(searchDelivery2, replaceDelivery); // There are two identical blocks, one for API and one for fallback

const searchAnimal = `                if (rewardType === 'Shiny Feather') {
                    const isCompleted = completedBounties.includes(req.id);`;

const replaceAnimal = `                if (rewardType === 'Shiny Feather') {
                    if (req.name.toLowerCase().includes('cow') || req.name.toLowerCase().includes('sheep')) {
                        rewardAmount += 3;
                    }
                    const isCompleted = completedBounties.includes(req.id);`;

code = code.replace(searchAnimal, replaceAnimal);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Fixed farmRoutes.cjs');
