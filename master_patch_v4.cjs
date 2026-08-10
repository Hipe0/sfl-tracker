const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8').replace(/\r\n/g, '\n');

// --- 1. Fix 'claimed' status for Deliveries ---
// For Coins/Flower
code = code.replace(
`            const reqItems = [];
            itemsTd.find('.badge').each((k, bEl) => {`,
`            const reqItems = [];
            let hasCheckCircle = false;
            itemsTd.find('.badge').each((k, bEl) => {
              if ($l(bEl).find('.bi-check2-circle').length > 0) hasCheckCircle = true;`
);

code = code.replace(
`            if (rTrEl.length > 0) {
               const rText = rTrEl.text().trim();
               if (rText.includes('Claimed')) isClaimed = true;`,
`            if (rTrEl.length > 0) {
               const rText = rTrEl.text().trim();
               if (rText.includes('Claimed') || hasCheckCircle) isClaimed = true;`
);

// For Tickets
code = code.replace(
`            const reqItems = [];
            itemsTd.find('.badge').each((k, bEl) => {`,
`            const reqItems = [];
            let hasCheckCircle = false;
            itemsTd.find('.badge').each((k, bEl) => {
              if ($c(bEl).find('.bi-check2-circle').length > 0) hasCheckCircle = true;`
);

code = code.replace(
`                if (trText.includes('Claimed') || trText.includes('Reward')) {
                  if (trHtml.includes('tickets/')) isTicketReward = true;
                  if (trText.includes('Claimed')) claimed = true;`,
`                if (trText.includes('Claimed') || trText.includes('Reward')) {
                  if (trHtml.includes('tickets/')) isTicketReward = true;
                  if (trText.includes('Claimed') || hasCheckCircle) claimed = true;`
);

// --- 2. Fix Animals API and Bonus ---
// Since it was deleted, I will re-inject the API logic in the Animals loop
const animalsLoopTarget = `          let status = 'not_ready';
          if ($c(taskEl).hasClass('text-bg-success')) status = 'claimed';
          else if ($c(taskEl).hasClass('text-bg-warning')) status = 'not_ready';
          else if ($c(taskEl).hasClass('text-bg-danger')) status = 'ready'; // Danger usually means ready/need action? Or maybe we map 'danger' to missing level? Let's just use 'ready' if danger, 'claimed' if success, 'not_ready' if warning. Wait!
          // Actually, text-bg-warning = blue in their old style? No, warning is yellow. success is green (bdone), danger is red. 
          // Let's stick to status:
          if ($c(taskEl).hasClass('text-bg-success')) status = 'claimed';
          if ($c(taskEl).hasClass('text-bg-danger')) status = 'ready';
          
          if (animalName) {
            animals.push({ animalName, level, reward, status });
          }`;

const animalsLoopReplacement = `          let status = 'not_ready';
          if ($c(taskEl).hasClass('text-bg-success')) status = 'claimed';
          else if ($c(taskEl).hasClass('text-bg-danger')) status = 'ready';
          
          let rewardType = 'Coins';
          
          if (gameData && gameData.bounties) {
              const completedBounties = gameData.bounties.completed || [];
              const bReqs = (gameData.bounties.requests || []).filter(r => r.name.toLowerCase().includes(animalName.toLowerCase()));
              let req = null;
              if (bReqs.length > 0) {
                 req = bReqs.find(r => {
                    if (r.coins && r.coins === reward) return true;
                    if (r.items) {
                       const itemAmount = Object.values(r.items)[0];
                       if (itemAmount === reward) return true;
                    }
                    return false;
                 }) || bReqs[0];
              }
              
              if (req) {
                 if (req.items && Object.keys(req.items).length > 0) {
                     rewardType = Object.keys(req.items)[0];
                     reward = req.items[rewardType];
                 } else if (req.coins > 0) {
                     rewardType = 'Coins';
                     reward = req.coins;
                 }
                 status = completedBounties.some(cb => cb.id === req.id) ? 'claimed' : status;
              }
          }
          
          if (rewardType === 'Shiny Feather') {
              let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
              reward += ticketClothesBuff;
          }
          
          if (animalName) {
            animals.push({ animalName, level, reward, rewardType, status });
          }`;

code = code.replace(animalsLoopTarget, animalsLoopReplacement);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log("Applied master_patch_v4.cjs");
