const fs = require('fs');
const recipes = JSON.parse(fs.readFileSync('./src/data/foodRecipes.json', 'utf8'));
console.log(Object.keys(recipes).filter(k => k.includes('Cake')));
