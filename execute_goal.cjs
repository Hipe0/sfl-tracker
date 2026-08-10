const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// --- Task 1: Weekly Chores Bonus ---
const choreEndIndex = code.indexOf("let status = 'not_ready';", code.indexOf('// 3. Weekly Chores'));
if (choreEndIndex > -1) {
    const insertCode = `
          if (rewardType === 'Shiny Feather') {
              const ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
              const choreVipBuff = (inventory.hasVip ? 2 : 0);
              rewardAmount += (ticketClothesBuff + choreVipBuff);
          }
          `;
    code = code.substring(0, choreEndIndex) + insertCode + code.substring(choreEndIndex);
}

// --- Task 2: Deliveries Item Parsing ---
const reqItemsEndIndex = code.indexOf('let reward = \'\';', code.indexOf('const reqItems = [];'));
if (reqItemsEndIndex > -1) {
    const sflOrderBlock = `
            let sflOrderReq = null;
            if (gameData && gameData.delivery && gameData.delivery.orders) {
                sflOrderReq = gameData.delivery.orders.find(o => o.from.toLowerCase() === npcName.toLowerCase());
                if (sflOrderReq && sflOrderReq.items) {
                    reqItems.length = 0; // Clear fallback
                    for (const [itemName, qty] of Object.entries(sflOrderReq.items)) {
                        const currAmt = inventory[itemName] || 0;
                        reqItems.push({ name: itemName, completed: currAmt, total: qty, enough: currAmt >= qty });
                        if (currAmt < qty) allEnough = false;
                    }
                }
            }
            `;
    code = code.substring(0, reqItemsEndIndex) + sflOrderBlock + code.substring(reqItemsEndIndex);
}

// --- Task 3: Bounties Ticket Count & Avg Cost ---
const bountyMatchIndex = code.indexOf('// Match with API gameData.bounties.requests', code.indexOf('// 4. Bounties'));
if (bountyMatchIndex > -1) {
    const bountyEndIndex = code.indexOf('let status = \'not_ready\';', bountyMatchIndex);
    
    const newBountyLogic = `
            // Match with API gameData.bounties.requests
            if (gameData && gameData.bounties && gameData.bounties.requests) {
                const bReq = gameData.bounties.requests.find(r => (r.name||'').toLowerCase() === choreText.toLowerCase());
                if (bReq) {
                    if (bReq.items && Object.keys(bReq.items).length > 0) {
                        rewardType = Object.keys(bReq.items)[0];
                        reward = bReq.items[rewardType];
                    } else if (bReq.coins > 0) {
                        rewardType = 'Coins';
                        reward = bReq.coins;
                    }
                    
                    if (rewardType === 'Shiny Feather') {
                        const ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                        reward += ticketClothesBuff;
                    }
                }
            }
            `;
    code = code.substring(0, bountyMatchIndex) + newBountyLogic + code.substring(bountyEndIndex);
}

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
