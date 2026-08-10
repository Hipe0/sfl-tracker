const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Re-apply Buffs
// A. Animals buff
code = code.replace(
`            if (rewardType === 'Shiny Feather') {
                if (req.name.toLowerCase().includes('cow') || req.name.toLowerCase().includes('sheep')) {
                    let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                    rewardAmount += ticketClothesBuff;
                }`,
`            if (rewardType === 'Shiny Feather') {
                let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                rewardAmount += ticketClothesBuff;`
);

// B. Bounties buff
code = code.replace(
`                 if (rewardType === 'Shiny Feather' && summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                     reward += 100;
                 }`,
`                 if (rewardType === 'Shiny Feather') {
                     let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                     reward += ticketClothesBuff;
                     if (inventory.hasVip) reward += 2;
                     
                     if (summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                         reward += 100;
                     }
                 }`
);

// 2. Fix the Delivery parsing (Pumpkin15 bug)
// We will replace the entire logic for parsing badge
code = code.replace(
`              let completed = 0, total = 0, enough = false;
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
              }`,
`              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              } else if ($c(bEl).find('.bi-check2-circle').length > 0) {
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || parseInt($c(bEl).text().replace(/[^0-9]/g, '')) || 0;
                completed = total;
                enough = true;
              }
              
              if (itemName) {
                reqItems.push({ name: itemName, completed, total, enough });
              } else {
                const fallback = $c(bEl).text().trim().replace(/\\s+/g, ' ');
                reqItems.push({ name: fallback, completed, total, enough: true });
              }`
);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log("Patched farmRoutes.cjs");
