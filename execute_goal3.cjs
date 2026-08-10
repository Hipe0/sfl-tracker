const fs = require('fs');

// --- 1. Deliveries Parsing & HTML Fallback ---
let routesCode = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// Fix API Deliveries (gameData.inventory instead of local inventory)
const apiDelTarget = `const currAmt = inventory[itemName] || 0;`;
const apiDelReplace = `const currAmt = (gameData && gameData.inventory && gameData.inventory[itemName] ? parseFloat(gameData.inventory[itemName]) : 0);`;
routesCode = routesCode.replace(apiDelTarget, apiDelReplace);

// Fix HTML Fallback for Deliveries (Olive 0 / 6 -> name: 'Olive', total: 6)
const fallbackTarget = `const fallback = $c(bEl).text().trim().replace(/\\s+/g, ' ');
                reqItems.push({ name: fallback, completed: 0, total: 0, enough: true });`;
const fallbackReplace = `const fallbackStr = $c(bEl).text().trim();
                const parseMatch = fallbackStr.match(/([a-zA-Z\\s']+?)\\s*\\d+\\s*\\/\\s*(\\d+)/);
                if (parseMatch) {
                    const itemName = parseMatch[1].trim();
                    const qty = parseInt(parseMatch[2]);
                    const currAmt = (gameData && gameData.inventory && gameData.inventory[itemName] ? parseFloat(gameData.inventory[itemName]) : 0);
                    reqItems.push({ name: itemName, completed: currAmt, total: qty, enough: currAmt >= qty });
                    if (currAmt < qty) allEnough = false;
                } else {
                    const cleanName = fallbackStr.replace(/\\d+\\s*\\/\\s*\\d+/g, '').replace(/[0-9]/g, '').trim();
                    const currAmt = (gameData && gameData.inventory && gameData.inventory[cleanName] ? parseFloat(gameData.inventory[cleanName]) : 0);
                    reqItems.push({ name: cleanName, completed: currAmt, total: 1, enough: currAmt >= 1 });
                }`;
routesCode = routesCode.replace(fallbackTarget, fallbackReplace);

// Update Summary Table for Animals
const animalsProgressTarget = `summary.animalsProgress = \`\${animals.filter(a => a.status === 'claimed').length}/\${animals.length}\`;`;
const animalsProgressReplace = `summary.animalsProgress = \`\${animals.filter(a => a.status === 'claimed').length}/\${animals.length}\`;
      if (summary.table) {
          const animalRow = summary.table.find(r => r.source.toLowerCase().includes('animal'));
          if (animalRow) {
              const comp = animals.filter(a => a.status === 'claimed').length;
              animalRow.claimed = comp;
              animalRow.total = animals.length;
              animalRow.left = animals.length - comp;
              animalRow.percent = animals.length > 0 ? Math.round((comp / animals.length) * 100) + '%' : '0%';
          }
      }`;
routesCode = routesCode.replace(animalsProgressTarget, animalsProgressReplace);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', routesCode);


// --- 2. Bounties +100 Bonus ---
let bountiesCode = fs.readFileSync('src/components/BountiesPanel.jsx', 'utf-8');
bountiesCode = bountiesCode.replace(/reward: 50,/g, 'reward: 100,');
bountiesCode = bountiesCode.replace(/\+50 Bonus/g, '+100 Bonus');
fs.writeFileSync('src/components/BountiesPanel.jsx', bountiesCode);


// --- 3. Deliveries Status (Đã Giao / Can Skip) ---
// Rewrite DeliveriesPanel.jsx status logic carefully to avoid syntax errors
let delPanelCode = fs.readFileSync('src/components/DeliveriesPanel.jsx', 'utf-8');
const oldStatusLogic = `            if (del.status === 'claimed') {
              statusBadge = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
              del.statusText = 'Đã giao';
              statusColor = 'from-emerald-900/40 to-slate-800/40 border-emerald-500/30';
            } else if (del.status === 'ready') {
              statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
              statusColor = 'from-amber-900/30 to-slate-800/40 border-amber-500/30';
            } else if (del.status === 'can_skip') {
              statusBadge = 'bg-slate-700 text-slate-300 border-slate-600';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
              del.statusText = 'Có thể Skip';
            } else {
              statusBadge = 'bg-slate-700 text-slate-400';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
            }`;

const newStatusLogic = `            if (del.status === 'claimed') {
              statusBadge = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
              del.statusText = 'Đã giao';
              statusColor = 'from-emerald-900/40 to-slate-800/40 border-emerald-500/30';
            } else if (del.status === 'ready') {
              statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
              statusColor = 'from-amber-900/30 to-slate-800/40 border-amber-500/30';
              del.statusText = 'Sẵn sàng';
            } else if (del.status === 'can_skip') {
              statusBadge = 'bg-slate-700 text-slate-300 border-slate-600';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
              del.statusText = 'Có thể Skip';
            } else {
              statusBadge = 'bg-slate-700 text-slate-400';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
              del.statusText = 'Chưa đủ';
            }`;
            
if (delPanelCode.includes(oldStatusLogic)) {
    delPanelCode = delPanelCode.replace(oldStatusLogic, newStatusLogic);
} else {
    // Fallback if the file structure is different due to my previous bad regex
    delPanelCode = delPanelCode.replace(/if \(del\.status === 'claimed'\) \{[\s\S]*?\} else \{[\s\S]*?bg-slate-800\/60 border-slate-700\/50';\s*\}/, newStatusLogic);
}
// Fix the text rendering
delPanelCode = delPanelCode.replace(/del\.status === 'ready' \? 'Ready' : \(del\.statusText \|\| 'Not Ready'\)/g, "del.statusText");
delPanelCode = delPanelCode.replace(/del\.status === 'ready' \? 'Ready' : 'Not Ready'/g, "del.statusText");
fs.writeFileSync('src/components/DeliveriesPanel.jsx', delPanelCode);


// --- 4. Season Analytics Animal Ticket Sum ---
let saCode = fs.readFileSync('src/components/SeasonAnalytics.jsx', 'utf-8');

const oldAnimalSum = `        if (a.rewardType === 'Shiny Feather') {
              dataByWeek[weekStr].animals.completed += (a.reward || 0);
            }
          
          dataByWeek[weekStr].summary.tickets += (a.reward || 0);
          totalSeasonTickets += (a.reward || 0);`;
          
const newAnimalSum = `        if (a.rewardType === 'Shiny Feather') {
            dataByWeek[weekStr].animals.completed += (a.reward || 0);
            dataByWeek[weekStr].summary.tickets += (a.reward || 0);
            totalSeasonTickets += (a.reward || 0);
        }`;
        
if (saCode.includes(oldAnimalSum)) {
    saCode = saCode.replace(oldAnimalSum, newAnimalSum);
} else {
    // If exact match fails, do regex
    saCode = saCode.replace(/if \(a\.rewardType === 'Shiny Feather'\) \{\s*dataByWeek\[weekStr\]\.animals\.completed \+= \(a\.reward \|\| 0\);\s*\}\s*dataByWeek\[weekStr\]\.summary\.tickets \+= \(a\.reward \|\| 0\);\s*totalSeasonTickets \+= \(a\.reward \|\| 0\);/g, newAnimalSum);
}
fs.writeFileSync('src/components/SeasonAnalytics.jsx', saCode);

