const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Initialize craftingCosts and toolCosts
code = code.replace('let p2pPrices = {};', 'let p2pPrices = {};\n      const craftingCosts = {};\n      const toolCosts = {};');

// 2. Remove the fishing try/catch block entirely
const fishRegex = /try \{\s*const fishRes = await fetch\('https:\/\/sfl\.world\/info\/fishing\/info'\);[\s\S]*?\} catch \(err\) \{\s*console\.error\("Error fetching fishing prices:", err\);\s*\}/g;
code = code.replace(fishRegex, '');

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Cleanup complete');
