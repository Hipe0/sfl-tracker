const fs = require('fs');

const tools = {
  'Axe': { coins: 20, ingredients: {} },
  'Pickaxe': { coins: 20, ingredients: { 'Wood': 3 } },
  'Stone Pickaxe': { coins: 20, ingredients: { 'Wood': 3, 'Stone': 3 } },
  'Iron Pickaxe': { coins: 80, ingredients: { 'Wood': 3, 'Iron': 3 } },
  'Gold Pickaxe': { coins: 100, ingredients: { 'Wood': 3, 'Gold': 3 } },
  'Rod': { coins: 20, ingredients: { 'Wood': 3 } },
  'Crab Pot': { coins: 250, ingredients: { 'Feather': 5, 'Wool': 3 } },
  'Mariner Pot': { coins: 500, ingredients: { 'Feather': 10, 'Merino Wool': 10 } },
  'Sand Shovel': { coins: 20, ingredients: { 'Wood': 2, 'Stone': 1 } }
};

fs.writeFileSync('src/data/toolPrices.json', JSON.stringify(tools, null, 2));
console.log('Saved to src/data/toolPrices.json');
