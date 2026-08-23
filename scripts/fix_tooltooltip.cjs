const fs = require('fs');

let code = fs.readFileSync('src/components/ToolTooltip.jsx', 'utf8');

code = code.replace(/const toolRecipes = \{[\s\S]*?\};\n/, '');
code = code.replace(/import React from 'react';/, 'import React from \'react\';\nimport toolPrices from \'../data/toolPrices.json\';');

code = code.replace(
  /const recipe = toolRecipes\[toolName\] \|\| \{ building: 'Blacksmith', ingredients: \{\} \};/,
  `
  const toolDef = toolPrices[toolName === 'Rod' ? 'Fishing Rod' : toolName] || toolPrices[toolName] || { coins: 0, ingredients: {} };
  let recipeIngredients = { ...toolDef.ingredients };
  if (toolDef.coins > 0) {
    recipeIngredients['Coins'] = toolDef.coins;
  }
  const recipe = {
    building: ['Rod', 'Fishing Rod', 'Crab Pot', 'Mariner Pot'].includes(toolName) ? 'Fisherman' : 'Blacksmith',
    ingredients: recipeIngredients
  };
  `
);

code = code.replace(/!toolRecipes\[toolName\]/g, '(!toolPrices[toolName === "Rod" ? "Fishing Rod" : toolName] && !toolPrices[toolName])');

fs.writeFileSync('src/components/ToolTooltip.jsx', code);
console.log('Fixed ToolTooltip');
