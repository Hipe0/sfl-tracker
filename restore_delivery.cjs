const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

const target = `} else if (order.reward.items) {
                    rewardType = Object.keys(order.reward.items)[0];
                    rewardAmount = order.reward.items[rewardType];
                }`;
                
const replacement = `} else if (order.reward.items) {
                    rewardType = Object.keys(order.reward.items)[0];
                    rewardAmount = order.reward.items[rewardType];
                } else if (Object.keys(order.reward).length === 0) {
                    rewardType = 'Shiny Feather';
                    // We don't know the exact base reward without complex SFL frontend logic, so we estimate 2.
                    rewardAmount = 2;
                }`;

code = code.replace(target, replacement);
fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
