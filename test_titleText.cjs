const fs = require('fs');
const code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');
const lines = code.split('\n');
lines.forEach((l, i) => {
    if (l.includes('if (titleText.includes')) console.log((i+1) + ': ' + l);
});
