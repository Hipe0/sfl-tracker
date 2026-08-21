/**
 * costCalculator.cjs - Module dùng chung để tính giá SFL đệ quy cho tất cả vật phẩm.
 * 
 * Được sử dụng bởi cả craftingRoutes.cjs và farmRoutes.cjs.
 * Giá trả về là giá P2P (đã trừ 10% thuế chợ).
 */
const fs = require('fs');
const path = require('path');

// Load JSON data (singleton - chỉ load 1 lần khi module được require)
const dataDir = path.join(__dirname, '../../src/data');
const toolPrices = JSON.parse(fs.readFileSync(path.join(dataDir, 'toolPrices.json'), 'utf8'));
const foodRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'foodRecipes.json'), 'utf8'));
const seedPrices = JSON.parse(fs.readFileSync(path.join(dataDir, 'seedPrices.json'), 'utf8'));
const cropRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'cropRecipes.json'), 'utf8'));
const flowerRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'flowerRecipes.json'), 'utf8'));
const dollRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'dollRecipes.json'), 'utf8'));
const fishingRecipes = JSON.parse(fs.readFileSync(path.join(dataDir, 'fishingRecipes.json'), 'utf8'));
const sellPrices = JSON.parse(fs.readFileSync(path.join(dataDir, 'sellPrices.json'), 'utf8'));

/**
 * Tạo một calculator instance với tỷ giá coin và giá P2P hiện tại.
 * 
 * @param {number} coinRateValue - Tỷ giá Coin (bao nhiêu coin = 1 SFL)
 * @param {Object} marketPrices - Giá Market từ sfl.world API (chưa trừ tax). Key = itemName, Value = market price (SFL).
 * @returns {{ getUniversalCost: Function, getCostForItems: Function }}
 */
function createCostCalculator(coinRateValue, marketPrices = {}) {
  const costCache = {};

  // Chuyển giá Market → giá P2P (trừ 10% thuế)
  const getP2PPrice = (itemName) => {
    const marketPrice = marketPrices[itemName];
    if (marketPrice !== undefined && marketPrice !== null) {
      return parseFloat(marketPrice) * 0.9; // Trừ 10% thuế chợ
    }
    return 0;
  };

  /**
   * Tính giá SFL (P2P) đệ quy cho 1 đơn vị vật phẩm.
   * Logic ưu tiên: food → tools → crafts/dolls → seeds → flowers → Oil → sellables → P2P market
   */
  const getUniversalCost = (itemName, seen = new Set()) => {
    if (costCache[itemName] !== undefined) return costCache[itemName];
    if (seen.has(itemName)) return 0; // Tránh vòng lặp vô hạn
    seen.add(itemName);

    let cost = 0;
    let isCraftable = false;

    // 1. Check food recipes (Cheese, Blue Cheese, etc.)
    if (foodRecipes[itemName] && foodRecipes[itemName].ingredients) {
      isCraftable = true;
      for (const [ingName, ingQty] of Object.entries(foodRecipes[itemName].ingredients)) {
        cost += getUniversalCost(ingName, new Set(seen)) * ingQty;
      }
    }
    // 2. Check tools (Axe, Pickaxe, Oil Drill, etc.)
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
    // 3. Check crafts/dolls (Crimsteel, Timber, Doll, etc.)
    else if (dollRecipes[itemName]) {
      isCraftable = true;
      const counts = {};
      for (const item of dollRecipes[itemName]) {
        if (item === null) continue; // Skip null slots
        counts[item] = (counts[item] || 0) + 1;
      }
      for (const [ingName, qty] of Object.entries(counts)) {
        cost += getUniversalCost(ingName, new Set(seen)) * qty;
      }
    }
    // 4. Check seeds (bought with coins)
    else if (seedPrices[itemName]) {
      isCraftable = true;
      cost = seedPrices[itemName] / coinRateValue;
    }
    // 5. Check flowers (chain breeding)
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
    // 6. Check special game mechanics (Oil)
    else if (itemName === 'Oil') {
      isCraftable = true;
      cost = getUniversalCost('Oil Drill', new Set(seen)) / 16.67; // Average yield 16.67 Oil per drill
    }
    // 7. Check sellable items (foraging, treasure, etc.)
    else if (sellPrices[itemName] !== undefined) {
      isCraftable = true;
      cost = sellPrices[itemName] / coinRateValue;
    }

    // Fallback to P2P market price if not craftable
    if (!isCraftable) {
      cost = getP2PPrice(itemName);
    }

    costCache[itemName] = cost;
    return cost;
  };

  /**
   * Tính tổng chi phí SFL (P2P) cho một object {itemName: quantity, ...}
   * Dùng cho Delivery: tính tổng cost của tất cả reqItems trong 1 đơn hàng.
   */
  const getCostForItems = (itemsObj) => {
    if (!itemsObj || typeof itemsObj !== 'object') return 0;
    let total = 0;
    for (const [itemName, qty] of Object.entries(itemsObj)) {
      if (itemName.toLowerCase() === 'coins') {
        // Coins giao hàng → quy ra SFL theo tỷ giá
        total += qty / coinRateValue;
      } else {
        total += getUniversalCost(itemName) * qty;
      }
    }
    return Number(total.toFixed(5));
  };

  return {
    getUniversalCost,
    getCostForItems,
    // Expose data references for modules that need them
    toolPrices,
    foodRecipes,
    seedPrices,
    cropRecipes,
    flowerRecipes,
    dollRecipes,
    fishingRecipes,
    sellPrices
  };
}

module.exports = { createCostCalculator };
