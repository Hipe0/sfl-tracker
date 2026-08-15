const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf8');

const choreMapStart = code.indexOf('// Map chore costs');
const choreMapEnd = code.indexOf('// If not a tool task, fall back to crafting/cooking costs');

if (choreMapStart === -1 || choreMapEnd === -1) {
  console.error("Could not find chore mapping section");
  process.exit(1);
}

const replacement = `    // Map chore costs
    let coinRateValue = 1200;
    if (marketStats && marketStats.bestCoinRate) {
      coinRateValue = parseFloat(marketStats.bestCoinRate);
    } else if (globalConfig.coinRate) {
      coinRateValue = parseFloat(globalConfig.coinRate.replace(/,/g, ''));
    }

    const getToolP2PCost = (toolName) => {
      const toolDef = toolPrices[toolName];
      if (!toolDef) return 0;
      
      let cost = 0;
      if (toolDef.ingredients) {
        for (const [ingName, amount] of Object.entries(toolDef.ingredients)) {
          cost += (p2pPrices[ingName] || 0) * amount;
        }
      }
      if (toolDef.coins && coinRateValue > 0) {
        cost += (toolDef.coins / coinRateValue);
      }
      return cost;
    };

    chores = chores.map(category => {
      return {
        ...category,
        items: category.items.map(item => {
          let choreCost = 0;
          let foundKey = null;
          let hasCost = false;

          // Check if it's a tool-based task
          if (item.name.match(/Craft\\s+\\d+\\s+Fishing Rods/i) || item.name.match(/Fish\\s+\\d+\\s+times/i)) {
            foundKey = 'Fishing Rod';
            choreCost = Number((getToolP2PCost('Rod') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Craft\\s+\\d+\\s+Mariner Pots?/i)) {
            foundKey = 'Mariner Pot';
            choreCost = Number((getToolP2PCost('Mariner Pot') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Craft\\s+\\d+\\s+Crab Pots?/i)) {
            foundKey = 'Crab Pot';
            choreCost = Number((getToolP2PCost('Crab Pot') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Chop\\s+\\d+\\s+Trees/i)) {
            foundKey = 'Axe';
            choreCost = Number((getToolP2PCost('Axe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\\s+\\d+\\s+Stones/i)) {
            foundKey = 'Pickaxe';
            choreCost = Number((getToolP2PCost('Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\\s+\\d+\\s+Iron/i)) {
            foundKey = 'Stone Pickaxe';
            choreCost = Number((getToolP2PCost('Stone Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\\s+\\d+\\s+Gold/i)) {
            foundKey = 'Iron Pickaxe';
            choreCost = Number((getToolP2PCost('Iron Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\\s+\\d+\\s+Crimstone/i)) {
            foundKey = 'Gold Pickaxe';
            choreCost = Number((getToolP2PCost('Gold Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Dig\\s+\\d+\\s+times/i)) {
            foundKey = 'Sand Shovel';
            choreCost = Number((getToolP2PCost('Sand Shovel') * item.total).toFixed(5));
            hasCost = true;
          }

          // Check if it's a crop or fruit task
          let matchCrop = item.name.match(/Harvest\\s+([A-Za-z\\s]+)\\s+\\d+\\s+times/i);
          let matchPick = item.name.match(/Pick\\s+\\d+\\s+([A-Za-z\\s]+)/i);
          let matchGrow = item.name.match(/Grow\\s+([A-Za-z\\s]+)\\s+\\d+\\s+times/i);

          if (matchCrop || matchPick || matchGrow) {
            let cropNameRaw = matchCrop ? matchCrop[1] : (matchPick ? matchPick[1] : matchGrow[1]);
            cropNameRaw = cropNameRaw.trim();
            const plurals = {
              'Potatoes': 'Potato',
              'Tomatoes': 'Tomato',
              'Radishes': 'Radish',
              'Blueberries': 'Blueberry',
              'Strawberries': 'Strawberry',
              'Cranberries': 'Cranberry',
              'Sunflowers': 'Sunflower',
              'Duskberries': 'Duskberry',
              'Cosmos': 'Cosmos',
              'Lotus': 'Lotus',
              'Cactus': 'Cactus'
            };

            let singularName = plurals[cropNameRaw];
            if (!singularName) {
              if (cropNameRaw.endsWith('s')) {
                singularName = cropNameRaw.slice(0, -1);
              } else {
                singularName = cropNameRaw;
              }
            }

            // Convert to Proper Case
            singularName = singularName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

            const seedName = \`\${singularName} Seed\`;
            if (seedPrices[seedName] !== undefined && coinRateValue > 0) {
              foundKey = singularName;
              
              let harvestsPerSeed = 1;
              if (['Apple', 'Orange', 'Lemon', 'Blueberry', 'Tomato', 'Banana'].includes(singularName)) harvestsPerSeed = 3;
              
              const seedCostInFLW = seedPrices[seedName] / coinRateValue;
              choreCost = Number(((seedCostInFLW / harvestsPerSeed) * item.total).toFixed(5));
              hasCost = true;
            }
          }

          if (hasCost) {
            return {
              ...item,
              itemType: foundKey,
              unitCost: choreCost / item.total,
              choreCost: choreCost,
              totalP2PCost: choreCost,
              totalMarketCost: null,
              avgCost: item.reward > 0 ? Number((choreCost / item.reward).toFixed(5)) : null
            };
          }

          `;

const newCode = code.substring(0, choreMapStart) + replacement + code.substring(choreMapEnd);
fs.writeFileSync('src-backend/routes/farmRoutes.cjs', newCode);
console.log("Replaced chore costs logic successfully.");
