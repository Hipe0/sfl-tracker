const fs = require('fs');
const recipes = JSON.parse(fs.readFileSync('./src/data/foodRecipes.json', 'utf8'));
console.log("Apple Pie building:", recipes["Apple Pie"] ? recipes["Apple Pie"].building : "NOT FOUND");
