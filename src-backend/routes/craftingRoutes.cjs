const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getHistoryCollection } = require('../config/db.cjs');

// Load JSON data
const dataDir = path.join(__dirname, '../../src/data');
const toolPrices = JSON.parse(fs.readFileSync(path.join(dataDir, 'toolPrices.json'), 'utf8'));
const foodRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'foodRecipes.json'), 'utf8'));
const seedPrices = JSON.parse(fs.readFileSync(path.join(dataDir, 'seedPrices.json'), 'utf8'));
const cropRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'cropRecipes.json'), 'utf8'));
const flowerRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'flowerRecipes.json'), 'utf8'));
const dollRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'dollRecipes.json'), 'utf8'));
const fishingRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'fishingRecipes.json'), 'utf8'));
const sellPrices = JSON.parse(fs.readFileSync(path.join(dataDir, 'sellPrices.json'), 'utf8'));

router.get('/', async (req, res) => {
  try {
    const { farmId } = req.query;
    if (!farmId) {
      return res.status(400).json({ success: false, error: 'Thiếu farmId' });
    }

    // Fetch DB history
    const historyCol = getHistoryCollection();
    let farmHistory = null;
    if (historyCol) {
      farmHistory = await historyCol.findOne({ _id: farmId });
    }

    // Get Coin Rate (Fallback to 1428 if not found)
    let coinRateValue = 1428;
    if (farmHistory && farmHistory.marketStats && farmHistory.marketStats.bestCoinRate > 0) {
      coinRateValue = parseFloat(farmHistory.marketStats.bestCoinRate);
    } else if (farmHistory && farmHistory.farmData && farmHistory.farmData.globalConfig && farmHistory.farmData.globalConfig.coinRate) {
      coinRateValue = parseFloat(farmHistory.farmData.globalConfig.coinRate.replace(/,/g, ''));
    }

    // Fetch P2P prices from sfl.world
    let p2pPrices = {};
    try {
      const p2pRes = await fetch('https://sfl.world/api/v1/prices');
      if (p2pRes.ok) {
        const p2pJson = await p2pRes.json();
        if (p2pJson.data && p2pJson.data.p2p) {
          p2pPrices = p2pJson.data.p2p;
        }
      }
    } catch (e) {
      console.error('[Crafting] Error fetching P2P prices', e);
    }

    const getP2PCost = (itemName) => {
      return (p2pPrices[itemName] !== undefined && p2pPrices[itemName] !== null) ? parseFloat(p2pPrices[itemName]) : 0;
    };

    const costCache = {};
    const getUniversalCost = (itemName, seen = new Set()) => {
      if (costCache[itemName] !== undefined) return costCache[itemName];
      if (seen.has(itemName)) return 0; // Prevent infinite loops
      seen.add(itemName);

      let cost = 0;
      let isCraftable = false;

      // Check food
      if (foodRecipes[itemName] && foodRecipes[itemName].ingredients) {
        isCraftable = true;
        for (const [ingName, ingQty] of Object.entries(foodRecipes[itemName].ingredients)) {
          cost += getUniversalCost(ingName, new Set(seen)) * ingQty;
        }
      }
      // Check tools
      else if (toolPrices[itemName]) {
        isCraftable = true;
        const def = toolPrices[itemName];
        if (def.coins) cost += (def.coins / coinRateValue);
        if (def.ingredients) {
          for (const [ingName, ingQty] of Object.entries(def.ingredients)) {
            cost += getUniversalCost(ingName, new Set(seen)) * ingQty;
          }
        }
      }
      // Check dolls
      else if (dollRecipes[itemName]) {
        isCraftable = true;
        const counts = {};
        for (const item of dollRecipes[itemName]) {
          counts[item] = (counts[item] || 0) + 1;
        }
        for (const [ingName, qty] of Object.entries(counts)) {
          cost += getUniversalCost(ingName, new Set(seen)) * qty;
        }
      }
      // Check seeds
      else if (seedPrices[itemName]) {
        isCraftable = true;
        cost = seedPrices[itemName] / coinRateValue;
      }
      // Check flowers
      else if (flowerRecipes[itemName]) {
        isCraftable = true;
        const def = flowerRecipes[itemName];
        if (def.bestRecipeChain) {
          for (const step of def.bestRecipeChain) {
            if (step.seed) {
              cost += getUniversalCost(step.seed, new Set(seen));
            }
          }
        } else if (def.seed) {
          cost += getUniversalCost(def.seed, new Set(seen));
        }
      }
      // Check special game mechanics
      else if (itemName === 'Oil') {
        isCraftable = true;
        cost = getUniversalCost('Oil Drill', new Set(seen)) / 16.67; // Average yield is 16.67 Oil per drill
      }
      // Check if it's a sellable item (foraging, treasure, etc)
      else if (sellPrices[itemName] !== undefined) {
        isCraftable = true;
        cost = sellPrices[itemName] / coinRateValue;
      }
      // Fallback to P2P if not craftable
      if (!isCraftable) {
        cost = getP2PCost(itemName);
      }

      costCache[itemName] = cost;
      return cost;
    };

    // 1. Tools
    const toolsData = [];
    for (const [name, def] of Object.entries(toolPrices)) {
      let coins = def.coins || 0;
      let ingCost = 0;
      let ingredients = [];
      if (coins > 0) {
        ingredients.push({ name: 'Coins', amount: coins, sflCost: coins / coinRateValue });
      }
      if (def.ingredients) {
        for (const [ingName, ingQty] of Object.entries(def.ingredients)) {
          const cost = getUniversalCost(ingName) * ingQty;
          ingredients.push({ name: ingName, amount: ingQty, sflCost: cost });
          ingCost += cost;
        }
      }
      const totalSfl = (coins / coinRateValue) + ingCost;
      toolsData.push({
        name,
        coins,
        ingredients,
        totalSfl
      });
    }

    // 2. Food
    const foodData = [];
    for (const [name, def] of Object.entries(foodRecipes)) {
      let ingCost = 0;
      let ingredients = [];
      if (def.ingredients) {
        for (const [ingName, ingQty] of Object.entries(def.ingredients)) {
          const cost = getUniversalCost(ingName) * ingQty;
          ingredients.push({ name: ingName, amount: ingQty, sflCost: cost });
          ingCost += cost;
        }
      }
      foodData.push({
        name,
        coins: 0,
        ingredients,
        totalSfl: ingCost
      });
    }

    // 3. Seeds / Crops
    const seedsData = [];
    for (const [seedName, price] of Object.entries(seedPrices)) {
      let cropYield = '';
      for (const [cName, cDef] of Object.entries(cropRecipes)) {
        if (cDef.seed === seedName) {
          cropYield = cName;
          break;
        }
      }
      
      const coins = parseFloat(price);
      const totalSfl = coins / coinRateValue;
      seedsData.push({
        name: seedName,
        yield: cropYield,
        coins,
        ingredients: [{ name: 'Coins', amount: coins, sflCost: totalSfl }],
        totalSfl
      });
    }

    // 4. Crafts (Recursive, previously Dolls)
    const craftsData = [];
    for (const [craftName, ingredientsList] of Object.entries(dollRecipes)) {
      const counts = {};
      for (const item of ingredientsList) {
        if (item === null) continue; // Skip null slots
        counts[item] = (counts[item] || 0) + 1;
      }
      const ingredients = Object.entries(counts).map(([n, q]) => {
        const itemCost = getUniversalCost(n) * q;
        return { name: n, amount: q, sflCost: itemCost };
      });
      const totalSfl = getUniversalCost(craftName);
      craftsData.push({
        name: craftName,
        coins: 0,
        ingredients,
        totalSfl
      });
    }

    // 5. Flowers (Chain)
    const flowersData = [];
    for (const [flowerName, def] of Object.entries(flowerRecipes)) {
      if (def.bestRecipeChain) {
        let totalCoins = 0;
        let ingredients = [];
        for (const step of def.bestRecipeChain) {
          if (step.seed) {
            const seedPrice = seedPrices[step.seed] || 0;
            totalCoins += seedPrice;
            ingredients.push({ name: step.seed, amount: 1, sflCost: seedPrice / coinRateValue });
          }
        }
        const grouped = {};
        for (const ing of ingredients) {
          if (!grouped[ing.name]) grouped[ing.name] = { amount: 0, sflCost: 0 };
          grouped[ing.name].amount += ing.amount;
          grouped[ing.name].sflCost += ing.sflCost;
        }
        const finalIngredients = Object.entries(grouped).map(([n, data]) => ({ name: n, amount: data.amount, sflCost: data.sflCost }));
        if (totalCoins > 0) {
          finalIngredients.unshift({ name: 'Coins', amount: totalCoins, sflCost: totalCoins / coinRateValue });
        }
        const totalSfl = totalCoins / coinRateValue;
        flowersData.push({
          name: flowerName,
          coins: totalCoins,
          ingredients: finalIngredients,
          totalSfl
        });
      } else {
        const seedPrice = seedPrices[def.seed] || 0;
        let ingredients = [];
        if (seedPrice > 0) {
          const sflC = seedPrice / coinRateValue;
          ingredients.push({ name: 'Coins', amount: seedPrice, sflCost: sflC });
          ingredients.push({ name: def.seed, amount: 1, sflCost: sflC });
        }
        const totalSfl = seedPrice / coinRateValue;
        flowersData.push({
          name: flowerName,
          coins: seedPrice,
          ingredients,
          totalSfl
        });
      }
    }

    // 6. Fishing
    const fishingData = [];
    for (const [fishName, options] of Object.entries(fishingRecipes)) {
      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        let ingredients = [];
        let potCost = 0;
        
        const potDef = toolPrices[opt.pot];
        if (potDef) {
          if (potDef.coins) {
            const sflC = potDef.coins / coinRateValue;
            ingredients.push({ name: 'Coins', amount: potDef.coins, sflCost: sflC });
            potCost += sflC;
          }
          if (potDef.ingredients) {
            for (const [n, q] of Object.entries(potDef.ingredients)) {
              const cost = getUniversalCost(n) * q;
              ingredients.push({ name: n, amount: q, sflCost: cost });
              potCost += cost;
            }
          }
        }
        
        let chumCost = 0;
        if (opt.chum && opt.chum !== 'None') {
          const cost = getUniversalCost(opt.chum) * (opt.amount || 1);
          ingredients.push({ name: opt.chum, amount: opt.amount || 1, sflCost: cost });
          chumCost += cost;
        }
        
        const totalSfl = potCost + chumCost;
        fishingData.push({
          name: `${fishName} (Mồi: ${opt.chum === 'None' ? 'Không' : opt.chum})`,
          coins: potDef ? (potDef.coins || 0) : 0,
          ingredients,
          totalSfl
        });
      }
    }

    // 7. Sellables
    const sellablesData = [];
    for (const [itemName, price] of Object.entries(sellPrices)) {
      sellablesData.push({
        name: itemName,
        coins: price,
        ingredients: [{ name: 'Coins', amount: price, sflCost: price / coinRateValue }],
        totalSfl: price / coinRateValue
      });
    }

    return res.json({
      success: true,
      data: {
        coinRate: coinRateValue,
        categories: {
          tools: toolsData,
          food: foodData,
          seeds: seedsData,
          flowers: flowersData,
          crafts: craftsData,
          fishing: fishingData,
          sellables: sellablesData
        }
      }
    });

  } catch (error) {
    console.error('Crafting costs error:', error);
    res.status(500).json({ success: false, error: 'Lỗi server' });
  }
});

module.exports = router;
