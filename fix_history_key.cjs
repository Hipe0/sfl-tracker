const fs = require('fs');

// 1. Fix farmRoutes.cjs to include id
let routeCode = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');
const searchPush = `animals.push({
                          name: req.name,`;
const replacePush = `animals.push({
                          id: req.id,
                          name: req.name,`;
routeCode = routeCode.replace(searchPush, replacePush);
fs.writeFileSync('src-backend/routes/farmRoutes.cjs', routeCode);

// 2. Fix historyService.cjs to use a.id
let historyCode = fs.readFileSync('src-backend/services/historyService.cjs', 'utf-8');
const searchKey = `const animalKey = \`\${a.animalName}-\${a.level}\`;`;
const replaceKey = `const animalKey = a.id || \`\${a.animalName}-\${a.level}\`;`;
historyCode = historyCode.replace(searchKey, replaceKey);

const searchReward = `week: weekStr,
              reward: a.reward
            };`;
const replaceReward = `week: weekStr,
              reward: a.reward,
              rewardType: a.rewardType
            };`;
historyCode = historyCode.replace(searchReward, replaceReward);

fs.writeFileSync('src-backend/services/historyService.cjs', historyCode);
