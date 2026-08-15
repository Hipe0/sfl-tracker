const fs = require('fs');
const path = require('path');

const gameSrcDir = 'd:/sunflower-land/src/features/game/types';
const files = ['crops.ts', 'fruits.ts', 'flowers.ts'];

let prices = {};

files.forEach(file => {
    const filePath = path.join(gameSrcDir, file);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Look for price declarations inside seed definitions
    const regex = /"([^"]+ Seed)":\s*\{[^}]*price:\s*([\d.]+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        prices[match[1]] = parseFloat(match[2]);
    }
    
    // Also look for unquoted keys
    const regex2 = /([A-Za-z]+ Seed):\s*\{[^}]*price:\s*([\d.]+)/g;
    while ((match = regex2.exec(content)) !== null) {
        prices[match[1]] = parseFloat(match[2]);
    }
});

fs.writeFileSync('src/data/seedPrices.json', JSON.stringify(prices, null, 2));
console.log('Saved to src/data/seedPrices.json');
