const fs = require('fs');

// --- Task 4: Animals Progress ---
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');
const resJsonStart = code.lastIndexOf('res.json({');
if (resJsonStart > -1) {
    const progressCode = `
    summary.animalsProgress = \`\${animals.filter(a => a.status === 'claimed').length}/\${animals.length}\`;
    `;
    code = code.substring(0, resJsonStart) + progressCode + code.substring(resJsonStart);
    fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
}

// Modify AnimalsPanel.jsx to display the progress
let animalsUi = fs.readFileSync('src/components/AnimalsPanel.jsx', 'utf-8');
const headerIdx = animalsUi.indexOf('Animals (Feathers Only)');
if (headerIdx > -1) {
    // Add summary
    const replaceStr = '<span className="flex items-center"><img src="https://sfl.world/img/animals/Chicken.png" alt="Animals" className="w-6 h-6 mr-2 object-contain drop-shadow-sm" /> Animals (Feathers Only)</span>';
    const newStr = '<span className="flex items-center w-full justify-between"><span className="flex items-center"><img src="https://sfl.world/img/animals/Chicken.png" alt="Animals" className="w-6 h-6 mr-2 object-contain drop-shadow-sm" /> Animals (Feathers)</span><span className="text-xs bg-slate-800 px-2 py-1 rounded border border-slate-600 text-slate-300">Tiến độ: {farmData?.summary?.animalsProgress || "0/0"}</span></span>';
    animalsUi = animalsUi.replace(replaceStr, newStr);
    fs.writeFileSync('src/components/AnimalsPanel.jsx', animalsUi);
}

// --- Task 5: Deliveries Status ---
// Actually we already have claimed = true handled in HTML parsing, but let's check Skip status
code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');
const deliveryStatusIdx = code.indexOf("const status = claimed ? 'claimed' : (reqItems.length === 0 ? 'inactive' : (allEnough ? 'ready' : 'not_ready'));");
if (deliveryStatusIdx > -1) {
    const skipLogic = `
            let status = claimed ? 'claimed' : (reqItems.length === 0 ? 'inactive' : (allEnough ? 'ready' : 'not_ready'));
            // Check if can skip (SFL deliveries can be skipped if they are active)
            if (!claimed && reqItems.length > 0) {
                status = 'can_skip'; // Just visually tag them as skippable
            }
            if (allEnough && !claimed) status = 'ready'; // ready takes precedence visually
    `;
    code = code.replace("const status = claimed ? 'claimed' : (reqItems.length === 0 ? 'inactive' : (allEnough ? 'ready' : 'not_ready'));", skipLogic);
    fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
}

// Modify DeliveriesPanel.jsx
let delUi = fs.readFileSync('src/components/DeliveriesPanel.jsx', 'utf-8');
delUi = delUi.replace(/else if \(del.status === 'ready'\) \{/g, "else if (del.status === 'ready') {\n              statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';\n              statusColor = 'from-amber-900/30 to-slate-800/40 border-amber-500/30';\n            } else if (del.status === 'can_skip') {\n              statusBadge = 'bg-slate-700 text-slate-300 border-slate-600';\n              statusColor = 'bg-slate-800/60 border-slate-700/50';\n              del.statusText = 'Có thể Skip';\n            } else {");

delUi = delUi.replace(/del\.status === 'ready' \? 'Ready' : 'Not Ready'/g, "del.status === 'ready' ? 'Ready' : (del.statusText || 'Not Ready')");

// Also add a 'Đã giao' label for claimed status which was missing text? Wait, let's just make it say Đã giao
delUi = delUi.replace(/statusBadge = 'bg-emerald-500\/20 text-emerald-400 border border-emerald-500\/30';/g, "statusBadge = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';\n              del.statusText = 'Đã giao';");

fs.writeFileSync('src/components/DeliveriesPanel.jsx', delUi);

// --- Task 6: Season Analytics Animal Ticket Sum ---
let saUi = fs.readFileSync('src/components/SeasonAnalytics.jsx', 'utf-8');
const aIdx = saUi.indexOf("dataByWeek[weekStr].animals.completed += (a.reward || 0);");
if (aIdx > -1) {
    const aReplace = `if (a.rewardType === 'Shiny Feather') {\n            dataByWeek[weekStr].animals.completed += (a.reward || 0);\n          }`;
    saUi = saUi.replace("dataByWeek[weekStr].animals.completed += (a.reward || 0);", aReplace);
    fs.writeFileSync('src/components/SeasonAnalytics.jsx', saUi);
}
