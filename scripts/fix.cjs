const fs = require('fs');
const file = 'd:/sunflower-land/sfl-tracker/src-backend/routes/farmRoutes.cjs';
let content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');
const targetLineIdx = lines.findIndex((l, i) => i > 880 && l.includes('const isCompleted = completedBounties.includes(req.id);'));
if (targetLineIdx > 0) {
    lines.splice(targetLineIdx, 0, '        if (rewardType !== "Shiny Feather") return;');
    fs.writeFileSync(file, lines.join('\n'));
    console.log('Fixed');
} else {
    console.log('Not found');
}
