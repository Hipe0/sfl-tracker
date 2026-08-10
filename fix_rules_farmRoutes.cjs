const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');
const originalCode = code;

// 1. Error Handling (Rule 8) - Fix API Fetch
const apiTarget = \`    // Then fetch sfl.world in parallel
    const [chapterRes, infoRes, boostRes, craftingRes, cookingRes, pricesRes] = await Promise.all([
      fetch(\\\`https://sfl.world/land/\\\${farmId}/chapter\\\`),
      fetch(\\\`https://sfl.world/land/\\\${farmId}\\\`),
      fetch(\\\`https://sfl.world/boost/\\\${farmId}\\\`),
      fetch('https://sfl.world/info/crafting'),
      fetch('https://sfl.world/info/cooking'),
      fetch('https://sfl.world/api/v1/prices')
    ]);\`;
const apiReplacement = \`    // Then fetch sfl.world in parallel
    let chapterRes, infoRes, boostRes, craftingRes, cookingRes, pricesRes;
    try {
      [chapterRes, infoRes, boostRes, craftingRes, cookingRes, pricesRes] = await Promise.all([
        fetch(\\\`https://sfl.world/land/\\\${farmId}/chapter\\\`),
        fetch(\\\`https://sfl.world/land/\\\${farmId}\\\`),
        fetch(\\\`https://sfl.world/boost/\\\${farmId}\\\`),
        fetch('https://sfl.world/info/crafting'),
        fetch('https://sfl.world/info/cooking'),
        fetch('https://sfl.world/api/v1/prices')
      ]);
    } catch (e) {
      return res.status(500).json({ error: "L\\u1ED7i m\\u1EA1ng: Kh\\u00F4ng th\\u1EC3 k\\u1EBFt n\\u1ED1i \\u0111\\u1EBFn API sfl.world. Vui l\\u00F2ng th\\u1EED l\\u1EA1i sau!" });
    }
    
    if (chapterRes.status === 429) {
      return res.status(429).json({ error: "API sfl.world \\u0111ang b\\u1ECB qu\\u00E1 t\\u1EA3i (Rate Limit). Vui l\\u00F2ng \u0111\u1EE3i 1 ph\u00FAt v\u00E0 th\u1EED l\u1EA1i!" });
    }
    if (!chapterRes.ok) {
      return res.status(500).json({ error: "L\\u1ED7i t\\u1EEB sfl.world API: " + chapterRes.statusText });
    }\`;

if (code.includes(apiTarget)) code = code.replace(apiTarget, apiReplacement);

const sflApiTarget = \`        const communityRes = await fetch(\\\`https://api.sunflower-land.com/community/farms/\\\${farmId}\\\`, {
          headers: { 'x-api-key': apiKey }
        });
        if (communityRes.ok) {\`;
const sflApiReplacement = \`        const communityRes = await fetch(\\\`https://api.sunflower-land.com/community/farms/\\\${farmId}\\\`, {
          headers: { 'x-api-key': apiKey }
        });
        if (communityRes.status === 429) {
           return res.status(429).json({ error: "API Sunflower Land \\u0111ang b\\u1ECB qu\\u00E1 t\\u1EA3i (Rate Limit). Vui l\\u00F2ng th\\u1EED l\\u1EA1i sau!" });
        }
        if (communityRes.ok) {\`;
if (code.includes(sflApiTarget)) code = code.replace(sflApiTarget, sflApiReplacement);

// Remove the old checking block:
const oldChapterCheckTarget = \`    if (!chapterRes.ok) {
      return res.status(500).json({ error: "Failed to fetch sfl.world chapter" });
    }\`;
if (code.includes(oldChapterCheckTarget)) code = code.replace(oldChapterCheckTarget, '');


// 2. Deliveries - Regex and Claimed check
const reqItemsTarget = \`            const reqItems = [];
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
            });\`;
const reqItemsReplacement = \`            const reqItems = [];
            let hasCheckCircle = false;
            itemsTd.find('.badge').each((k, bEl) => {
              let itemName = $c(bEl).find('div').first().text().trim();
              const smallEl = $c(bEl).find('small');
              const bEl2 = $c(bEl).find('b');
              const checkIcon = $c(bEl).find('.bi-check2-circle');
              
              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              } else if (checkIcon.length > 0) {
                const rawText = $c(bEl).text().trim();
                const numMatch = rawText.match(/\\d+/);
                total = numMatch ? parseInt(numMatch[0]) : 1;
                completed = total;
                enough = true;
                hasCheckCircle = true;
                if (!itemName) {
                   const nameMatch = rawText.match(/^[a-zA-Z\\s'-]+/);
                   if (nameMatch) itemName = nameMatch[0].trim();
                }
              }
              
              if (itemName) {
                const nameMatch = itemName.match(/^[a-zA-Z\\s'-]+/);
                if (nameMatch) itemName = nameMatch[0].trim();
              }

              if (itemName && total > 0) {
                reqItems.push({ name: itemName, completed, total, enough });
              } else {
                let fallback = $c(bEl).text().trim().replace(/\\s+/g, ' ');
                const fbNameMatch = fallback.match(/^[a-zA-Z\\s'-]+/);
                if (fbNameMatch) fallback = fbNameMatch[0].trim();
                reqItems.push({ name: fallback, completed: 0, total: 0, enough: true });
              }
            });
            if (hasCheckCircle) claimed = true;\`;
if (code.includes(reqItemsTarget)) code = code.replace(reqItemsTarget, reqItemsReplacement);


// 3. Bounties rules (Rule 1, Rule 3, Rule 4)
const bountiesTarget = \`            // Match with API gameData.bounties.requests if available
            if (gameData && gameData.bounties && gameData.bounties.requests) {
               const bReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase() === choreText.toLowerCase());
               if (bReqs.length > 0) {
                 // Try to match by reward amount (coins or gems)
                 const matchingReq = bReqs.find(r => {
                    if (r.coins && r.coins === reward) return true;
                    if (r.items) {
                       const itemAmount = Object.values(r.items)[0];
                       if (itemAmount === reward) return true;
                    }
                    return false;
                 });
                 
                 const selectedReq = matchingReq || bReqs[0];
                 if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    rewardType = Object.keys(selectedReq.items)[0];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
                 }
               } else {
                  // Fallback
                  if (rightDiv && rightDiv.html()) {
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
            }\`;
const bountiesReplacement = \`            // Match with API gameData.bounties.requests if available
            if (gameData && gameData.bounties && gameData.bounties.requests) {
               const bReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase().includes(choreText.toLowerCase()));
               if (bReqs.length > 0) {
                 const matchingReq = bReqs.find(r => {
                    if (r.coins && r.coins === reward) return true;
                    if (r.items) {
                       const itemAmount = Object.values(r.items)[0];
                       if (itemAmount === reward) return true;
                    }
                    return false;
                 });
                 
                 const selectedReq = matchingReq || bReqs[0];
                 if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    const itemName = Object.keys(selectedReq.items)[0];
                    rewardType = itemName;
                    reward = selectedReq.items[itemName];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
                    reward = selectedReq.coins;
                 } else if (selectedReq.sfl > 0) {
                    rewardType = 'SFL';
                    reward = selectedReq.sfl;
                 }
               } else {
                  // Fallback
                  if (rightDiv && rightDiv.html()) {
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

            // Apply Rule 1: VIP and Poppy Buffs
            if (rewardType === 'Shiny Feather') {
              if (inventory.hasVip) reward += 2;
              if (summary.poppyBounty && summary.poppyBounty.status !== 'danger') {
                reward += 100;
              }
            }\`;
if (code.includes(bountiesTarget)) code = code.replace(bountiesTarget, bountiesReplacement);


// And fix Pumpkin15 in Bounties just in case it appears in Bounties Progress
const bountiesProgressTarget = \`            const pMatch = progressText.match(/([0-9,]+)\\s*\\/\\s*([0-9,]+)/);
            if (pMatch) {
              completed = parseInt(pMatch[1].replace(/,/g, ''));
              total = parseInt(pMatch[2].replace(/,/g, ''));
            } else {
              const singleMatch = progressText.match(/([0-9,]+)/);
              if (singleMatch) {
                total = parseInt(singleMatch[1].replace(/,/g, ''));
                completed = total;
              }
            }\`;
const bountiesProgressReplacement = \`            const pMatch = progressText.match(/([0-9,]+)\\s*\\/\\s*([0-9,]+)/);
            if (pMatch) {
              completed = parseInt(pMatch[1].replace(/,/g, ''));
              total = parseInt(pMatch[2].replace(/,/g, ''));
            } else if ($c(bEl).find('.bi-check2-circle').length > 0) {
              const singleMatch = progressText.match(/([0-9,]+)/);
              if (singleMatch) {
                total = parseInt(singleMatch[1].replace(/,/g, ''));
                completed = total;
              } else {
                total = 1; completed = 1;
              }
            } else {
              const singleMatch = progressText.match(/([0-9,]+)/);
              if (singleMatch) {
                total = parseInt(singleMatch[1].replace(/,/g, ''));
                completed = total;
              }
            }\`;
if (code.includes(bountiesProgressTarget)) code = code.replace(bountiesProgressTarget, bountiesProgressReplacement);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Patched farmRoutes.cjs ' + (originalCode !== code ? 'successfully' : 'FAILED'));
