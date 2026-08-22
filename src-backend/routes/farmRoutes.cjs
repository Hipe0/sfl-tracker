const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { verifyToken } = require('../middlewares/auth.cjs');
const { getHistoryCollection } = require('../config/db.cjs');
const { recordFarmHistory } = require('../services/historyService.cjs');
const path = require('path');
const { sflCommunityQueue, sflWorldQueue } = require('../utils/apiQueue.cjs');
const { createCostCalculator } = require('../utils/costCalculator.cjs');
const { getISOYearWeek } = require('../utils/isoWeek.cjs');

let ascensionMilestones = [];
let foodRecipes = {};
let seedPrices = {};
let flowerRecipes = {};
let toolPrices = {};


const safeRequire = (filePath, defaultVal) => {
  try {
    return require(filePath);
  } catch (e) {
    console.warn("Could not load", filePath);
    return defaultVal;
  }
};

const choreFunctions = safeRequire('../utils/choreFunctions.cjs', {});

ascensionMilestones = safeRequire(path.join(__dirname, '../data/ascensionMilestones.json'), []);
foodRecipes = safeRequire(path.join(__dirname, '../../src/data/foodRecipes.json'), {});
seedPrices = safeRequire(path.join(__dirname, '../../src/data/seedPrices.json'), {});
flowerRecipes = safeRequire(path.join(__dirname, '../../src/data/flowerRecipes.json'), {});
toolPrices = safeRequire(path.join(__dirname, '../../src/data/toolPrices.json'), {});

const TICKET_REWARDS = { 
  "pumpkin' pete": 1, 
  "bert": 2, 
  "miranda": 2, 
  "finley": 2, 
  "raven": 4, 
  "finn": 5, 
  "timmy": 5, 
  "cornwell": 3, 
  "jester": 4, 
  "pharaoh": 6, 
  "tywin": 10 
};

const CHAPTER_TICKET_BOOST_ITEMS = {
  "Solar Flare": { basic: "Cow Scratcher", rare: "Cow Scratcher", epic: "Cow Scratcher" },
  "Dawn Breaker": { basic: "Cow Scratcher", rare: "Cow Scratcher", epic: "Cow Scratcher" },
  "Witches' Eve": { basic: "Cow Scratcher", rare: "Cow Scratcher", epic: "Cow Scratcher" },
  "Catch the Kraken": { basic: "Cow Scratcher", rare: "Cow Scratcher", epic: "Cow Scratcher" },
  "Spring Blossom": { basic: "Cow Scratcher", rare: "Cow Scratcher", epic: "Cow Scratcher" },
  "Clash of Factions": { basic: "Cow Scratcher", rare: "Cow Scratcher", epic: "Cow Scratcher" },
  "Pharaoh's Treasure": { basic: "Cow Scratcher", rare: "Cow Scratcher", epic: "Cow Scratcher" },
  "Bull Run": { basic: "Cowboy Hat", rare: "Cowboy Shirt", epic: "Cowboy Trouser" },
  "Winds of Change": { basic: "Acorn Hat", rare: "Igloo", epic: "Hammock" },
  "Great Bloom": { basic: "Flower Mask", rare: "Love Charm Shirt", epic: "Heart Air Balloon" },
  "Better Together": { basic: "Garbage Bin Hat", rare: "Raccoon Onesie", epic: "Recycle Shirt" },
  "Paw Prints": { basic: "Pet Specialist Hat", rare: "Pet Specialist Pants", epic: "Pet Specialist Shirt" },
  "Crabs and Traps": { basic: "Fish Hook Hat", rare: "Fish Hook Vest", epic: "Fish Hook Waders" },
  "Salt Awakening": { basic: "Spa Hat", rare: "Spa Robe", epic: "Spa Slippers" },
  "Ascension Age": { basic: "Swamp Lily Hat", rare: "Swamp Armor", epic: "Swamp Pants" }
};

const checkIsEquipped = (gameData, itemName) => {
  if (!gameData) return false;
  if (gameData.bumpkin?.equipped && Object.values(gameData.bumpkin.equipped).includes(itemName)) return true;
  if (gameData.farmHands?.bumpkins) {
    for (let fh of Object.values(gameData.farmHands.bumpkins)) {
      if (fh.equipped && Object.values(fh.equipped).includes(itemName)) return true;
    }
  }
  return false;
};
let ITEM_IDS = {};
try {
  ITEM_IDS = require('../data/bumpkinWearables.json');
} catch (e) {
  console.warn('Could not load bumpkinWearables.json');
}

function buildBumpkinUri(equipped) {
  if (!equipped) return null;
  const order = ['background', 'body', 'hair', 'shirt', 'pants', 'shoes', 'tool', 'hat', 'necklace', 'secondaryTool', 'coat', 'onesie', 'suit', 'wings', 'dress', 'beard', 'aura', 'eyes', 'mouth'];
  const ids = order.map(k => ITEM_IDS[equipped[k]] || 0);
  const lastPart = [...ids].reverse().findIndex(Boolean);
  const validIds = lastPart > 0 ? ids.slice(0, -lastPart) : ids;
  return '0_v1_' + validIds.join('_');
}

// ============================================================
// ENDPOINT: GET /api/crop-coins?farmId=XXXX
// Đặt TRƯỚC route /:id để tránh bị parameter route bắt trước
// ============================================================
const CROP_SELL_COINS = {
  // CROPS
  'Sunflower': 0.02,
  'Potato': 0.14,
  'Rhubarb': 0.24,
  'Pumpkin': 0.4,
  'Zucchini': 0.4,
  'Carrot': 0.8,
  'Yam': 0.8,
  'Cabbage': 1.5,
  'Broccoli': 1.5,
  'Soybean': 2.3,
  'Beetroot': 2.8,
  'Pepper': 3,
  'Cauliflower': 4.25,
  'Parsnip': 6.5,
  'Eggplant': 8,
  'Corn': 9,
  'Onion': 10,
  'Radish': 9.5,
  'Wheat': 7,
  'Turnip': 8,
  'Kale': 10,
  'Artichoke': 12,
  'Barley': 12,
  'Saltwort': 50,
  
  // GREENHOUSE CROPS
  'Rice': 320,
  'Olive': 400,

  // FRUITS
  'Tomato': 2,
  'Lemon': 6,
  'Blueberry': 12,
  'Orange': 18,
  'Apple': 25,
  'Banana': 25,
  'Celestine': 200,
  'Lunara': 500,
  'Duskberry': 1000,
  'Grape': 240,
};

const CROP_CATEGORY = {
  'Sunflower': 'crop', 'Potato': 'crop', 'Pumpkin': 'crop', 'Carrot': 'crop',
  'Cabbage': 'crop', 'Beetroot': 'crop', 'Cauliflower': 'crop', 'Parsnip': 'crop',
  'Eggplant': 'crop', 'Corn': 'crop', 'Radish': 'crop', 'Wheat': 'crop',
  'Kale': 'crop', 'Barley': 'crop', 'Onion': 'crop', 'Artichoke': 'crop',
  'Rhubarb': 'crop', 'Zucchini': 'crop', 'Yam': 'crop', 'Broccoli': 'crop',
  'Soybean': 'crop', 'Pepper': 'crop', 'Turnip': 'crop', 'Saltwort': 'crop',

  'Grape': 'greenhouse', 'Rice': 'greenhouse', 'Olive': 'greenhouse',

  'Celestine': 'fruit', 'Lunara': 'fruit', 'Duskberry': 'fruit',
  'Apple': 'fruit', 'Orange': 'fruit', 'Lemon': 'fruit', 'Banana': 'fruit',
  'Blueberry': 'fruit', 'Tomato': 'fruit'
};

const CROP_SKILL_BUFFS = {
  'Green Thumb': { ranks: { 1: 0.05, 2: 0.10, 3: 0.15 }, applies_to: 'crops' },
  'Coin Swindler': { ranks: { 1: 0.10, 2: 0.20, 3: 0.30 }, applies_to: 'crops' },
  'Cultivator': { ranks: { 1: 0.05, 2: 0.10, 3: 0.15 }, applies_to: 'fruits' },
  'Fruit Picker Profit': { ranks: { 1: 0.10, 2: 0.15, 3: 0.20 }, applies_to: 'fruits' },
};

router.get('/crop-coins', async (req, res) => {
  try {
    const { farmId } = req.query;
    const COIN_RATE = 320;

    // 1. Fetch P2P prices
    let p2pPrices = {};
    try {
      const pricesRes = await sflWorldQueue.add(() => fetch('https://sfl.world/api/v1/prices'));
      if (pricesRes.ok) {
        const priceData = await pricesRes.json();
        p2pPrices = priceData?.data?.p2p || {};
      }
    } catch (e) {
      console.error('[crop-coins] Failed to fetch P2P prices:', e.message);
    }

    // 2. Lấy skills từ DB cache nếu có farmId (không cần gọi lại API)
    let farmSkills = {};
    if (farmId) {
      try {
        const apiKey = process.env.SFL_API_KEY;
        if (apiKey) {
          const communityRes = await sflCommunityQueue.add(() =>
            fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
              headers: { 'x-api-key': apiKey }
            })
          );
          if (communityRes.ok) {
            const resData = await communityRes.json();
            farmSkills = resData?.farm?.bumpkin?.skills || {};
            const farmInventory = resData?.farm?.inventory || {};
            
            if (Number(farmInventory['Green Thumb']) > 0) {
              farmSkills['Green Thumb'] = 1;
            }
          }
        }
      } catch (e) {
        console.warn('[crop-coins] Failed to fetch farm skills:', e.message);
      }
    }

    // 3. Tính skill buffs
    const activeSkills = [];
    let cropBuff = 0;
    let fruitBuff = 0;
    for (const [skillName, skillDef] of Object.entries(CROP_SKILL_BUFFS)) {
      const rank = farmSkills[skillName];
      if (rank && rank >= 1) {
        const buffRate = skillDef.ranks[rank] || skillDef.ranks[Math.max(...Object.keys(skillDef.ranks).map(Number))] || 0;
        const pct = Math.round(buffRate * 100);
        activeSkills.push({
          name: skillName, rank, buff: buffRate,
          applies_to: skillDef.applies_to,
          label: `+${pct}% Coins`,
          description: `+${pct}% more coins when selling ${skillDef.applies_to} (Seed Shop)`
        });
        if (skillDef.applies_to === 'crops') cropBuff += buffRate;
        if (skillDef.applies_to === 'fruits') fruitBuff += buffRate;
      }
    }

    // 4. Build crop list
    const crops = [];
    for (const [cropName, baseSellCoins] of Object.entries(CROP_SELL_COINS)) {
      const p2pPrice = p2pPrices[cropName];
      if (!p2pPrice || p2pPrice <= 0) continue;
      const category = CROP_CATEGORY[cropName] || 'crop';
      const buff = category === 'fruit' ? fruitBuff : cropBuff;
      const buffedSellCoins = baseSellCoins * (1 + buff);
      const coinsPerFlower = buffedSellCoins / p2pPrice;
      const percentage = (coinsPerFlower - COIN_RATE) / COIN_RATE * 100;
      crops.push({
        name: cropName, category, baseSellCoins,
        buffedSellCoins: Number(buffedSellCoins.toFixed(3)),
        marketP2P: Number(p2pPrice.toFixed(6)),
        coinsPerFlower: Number(coinsPerFlower.toFixed(2)),
        percentage: Number(percentage.toFixed(2)),
        isProfitable: percentage > 0
      });
    }
    crops.sort((a, b) => b.coinsPerFlower - a.coinsPerFlower);

    res.json({
      success: true,
      data: { crops, activeSkills, coinRate: COIN_RATE, hasFarmId: !!farmId, timestamp: new Date().toISOString() }
    });
  } catch (err) {
    console.error('[crop-coins] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/history', (req, res, next) => next(), async (req, res) => {
  const farmId = req.params.id;
  if (false) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Bạn không có quyền truy cập dữ liệu của nông trại này.' });
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const pipeline = [
      { $match: { _id: farmId } },
      {
        $project: {
          _id: 1,
          bounties_completed: 1,
          animals_completed: 1,
          active_deliveries: 1,
          delivery_stats: 1,
          vip_gift: 1,
          baseline_daily_reward: 1,
          chores: 1,
          deliveries: {
            $arrayToObject: {
              $filter: {
                input: { $objectToArray: { $ifNull: ["$deliveries", {}] } },
                as: "item",
                cond: { $gte: ["$$item.k", thirtyDaysAgo] }
              }
            }
          },
          daily_chest: {
            $arrayToObject: {
              $filter: {
                input: { $objectToArray: { $ifNull: ["$daily_chest", {}] } },
                as: "item",
                cond: { $gte: ["$$item.k", thirtyDaysAgo] }
              }
            }
          }
        }
      }
    ];

    const results = await getHistoryCollection().aggregate(pipeline).toArray();
    const history = results[0];

    if (!history) {
      return res.json({ success: true, data: { deliveries: {}, chores: {}, bounties_completed: {}, animals_completed: {}, daily_chest: {} } });
    }

    // Filter chores (using approximate week filtering based on last 4-5 weeks)
    if (history.chores) {
      const filteredChores = {};
      const currentWeekTokens = getISOYearWeek(new Date()).split('-W');
      const currentYear = parseInt(currentWeekTokens[0]);
      const currentWeek = parseInt(currentWeekTokens[1]);

      Object.keys(history.chores).forEach(weekStr => {
        const [yearStr, weekNoStr] = weekStr.split('-W');
        const year = parseInt(yearStr);
        const week = parseInt(weekNoStr);

        let weekDiff = (currentYear - year) * 52 + (currentWeek - week);
        if (weekDiff <= 5) {
          filteredChores[weekStr] = history.chores[weekStr];
        }
      });
      history.chores = filteredChores;
    }

    res.json({ success: true, data: history });
  } catch (err) {
    console.error("Failed to fetch history:", err);
    res.status(500).json({ error: "Không thể kết nối đến Database" });
  }
});

router.get('/:id', (req, res, next) => { req.user = { farmId: req.params.id }; next(); }, async (req, res) => {
  const farmId = req.params.id;

  if (false) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Bạn không có quyền truy cập dữ liệu của nông trại này.' });
  }

  try {
    let publicData = null;
    let inventory = { hasHat: false, hasArmor: false, hasPants: false, hasVip: false, 'Shiny Feather': 0 };
    try {
      const sflRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/visit/${farmId}`));
      if (sflRes.ok) {
        publicData = await sflRes.json();
      }
    } catch (e) {
      console.error("SFL API error", e);
    }

    console.log(`\n--- Fetching data for Farm ID: ${farmId} ---`);

    const isCron = req.query.cron === 'true';

    // AUTO-UPDATE SFL.WORLD CACHE
    if (!isCron) {
      try {
        console.log(`[Auto-Update] Triggering sfl.world update for ${farmId}...`);
        const updateRes = await sflWorldQueue.add(() => fetch(`https://sfl.world/update/${farmId}`, { timeout: 5000 }));
        if (updateRes.ok) {
          await updateRes.json();
          console.log(`[Auto-Update] Update triggered successfully. Waiting 3.5s for cache to settle...`);
          await new Promise(r => setTimeout(r, 3500));
        }
      } catch (updateErr) {
        console.error(`[Auto-Update] Failed to trigger update, proceeding with potentially stale data:`, updateErr.message);
      }
    } else {
      console.log(`[Cron] Skipping sfl.world update for ${farmId} to save time.`);
    }

    // 0. Fetch historical data as fallback (in case API is rate limited)
    let farmHistory = null;
    try {
      farmHistory = await getHistoryCollection().findOne({ _id: farmId });
    } catch (e) {
      console.warn(`[History] Failed to find history for ${farmId}:`, e.message);
    }

    if (farmHistory && farmHistory.tracker_inventory) {
      inventory = { ...inventory, ...farmHistory.tracker_inventory };
    }

    // 1. Fetch from SFL Community API
    let gameData = null;
    const apiKey = process.env.SFL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Lỗi: Chưa cấu hình SFL_API_KEY. Vui lòng thiết lập biến môi trường này!" });
    }

    try {
      const communityRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
        headers: { 'x-api-key': apiKey }
      }));
      if (communityRes.status === 429) {
        return res.status(429).json({ error: "API Sunflower Land đang bị quá tải (Rate Limit). Vui lòng thử lại sau ít phút!" });
      }
      if (!communityRes.ok) {
        return res.status(500).json({ error: `Lỗi kết nối SFL API (Mã lỗi: ${communityRes.status}). Vui lòng thử lại sau.` });
      }
      
      const resData = await communityRes.json();
      if (!resData || !resData.farm) {
        return res.status(500).json({ error: "API trả về dữ liệu không hợp lệ hoặc nông trại không tồn tại." });
      }
      gameData = resData.farm;

      // Check VIP status from gameData.vip subscription
      if (gameData.vip && gameData.vip.expiresAt) {
        inventory.hasVip = gameData.vip.expiresAt > Date.now();
      }

      // Check Bonus Outfits dynamically from currently EQUIPPED items for the current season
      const currentSeason = 'Ascension Age';
      const chapterBoosts = CHAPTER_TICKET_BOOST_ITEMS[currentSeason];
      inventory.hasHat = false; inventory.hasArmor = false; inventory.hasPants = false;
      if (chapterBoosts) {
        if (checkIsEquipped(gameData, chapterBoosts.basic)) inventory.hasHat = true;
        if (checkIsEquipped(gameData, chapterBoosts.rare)) inventory.hasArmor = true;
        if (checkIsEquipped(gameData, chapterBoosts.epic)) inventory.hasPants = true;
      }
    } catch (e) {
      console.error("SFL Community API error", e);
      return res.status(500).json({ error: "Không thể lấy dữ liệu từ SFL API. Vui lòng kiểm tra lại kết nối mạng." });
    }

    // Then fetch sfl.world in parallel
    let chapterRes, landRes, boostRes, pricesRes;
    try {
      [chapterRes, landRes, boostRes, pricesRes] = await Promise.all([
        sflWorldQueue.add(() => fetch(`https://sfl.world/land/${farmId}/chapter`)),
        sflWorldQueue.add(() => fetch(`https://sfl.world/land/${farmId}`)),
        sflWorldQueue.add(() => fetch(`https://sfl.world/boost/${farmId}`)),
        sflWorldQueue.add(() => fetch('https://sfl.world/api/v1/prices'))
      ]);
    } catch (e) {
      return res.status(500).json({ error: "Lỗi mạng: Không thể kết nối đến API sfl.world. Vui lòng thử lại sau!" });
    }

    if (chapterRes.status === 429) {
      return res.status(429).json({ error: "API sfl.world đang bị quá tải (Rate Limit). Vui lòng đợi 1 phút và thử lại!" });
    }
    if (!chapterRes.ok) {
      return res.status(500).json({ error: "Lỗi từ sfl.world API: " + chapterRes.statusText });
    }

    let marketPrices = {};
    if (pricesRes.ok) {
      const priceData = await pricesRes.json();
      marketPrices = priceData?.data?.p2p || {};
    }

    // Calculate marketStats (bestCoinRate and flowerUsdPrice)
    let bestCoinRate = 0;
    const farmSkills = gameData?.bumpkin?.skills || {};
    if (Number(inventory['Green Thumb']) > 0) farmSkills['Green Thumb'] = 1;

    let cropBuff = 0;
    let fruitBuff = 0;
    if (typeof CROP_SKILL_BUFFS !== 'undefined') {
      for (const [skillName, skillDef] of Object.entries(CROP_SKILL_BUFFS)) {
        const rank = farmSkills[skillName];
        if (rank && rank >= 1) {
          const buffRate = skillDef.ranks[rank] || skillDef.ranks[Math.max(...Object.keys(skillDef.ranks).map(Number))] || 0;
          if (skillDef.applies_to === 'crops') cropBuff += buffRate;
          if (skillDef.applies_to === 'fruits') fruitBuff += buffRate;
        }
      }
    }

    if (typeof CROP_SELL_COINS !== 'undefined' && typeof CROP_CATEGORY !== 'undefined') {
      for (const [cropName, baseSellCoins] of Object.entries(CROP_SELL_COINS)) {
        const p2pPrice = marketPrices[cropName];
        if (!p2pPrice || p2pPrice <= 0) continue;
        const category = CROP_CATEGORY[cropName] || 'crop';
        const buff = category === 'fruit' ? fruitBuff : cropBuff;
        const buffedSellCoins = baseSellCoins * (1 + buff);
        const coinsPerFlower = buffedSellCoins / p2pPrice;
        if (coinsPerFlower > bestCoinRate) {
          bestCoinRate = coinsPerFlower;
        }
      }
    }

    let flowerUsdPrice = null;
    try {
      const geckoRes = await fetch('https://api.geckoterminal.com/api/v2/networks/base/pools/0xafe30319a948f322585fafc1cab1671a47eb3786');
      if (geckoRes.ok) {
        const geckoData = await geckoRes.json();
        flowerUsdPrice = Number(geckoData?.data?.attributes?.base_token_price_usd);
      }
    } catch (e) {
      console.error("GeckoTerminal fetch error:", e.message);
    }
    const marketStats = { bestCoinRate, flowerUsdPrice };

    let coinRateValue = 1200;
    let dbCoinRate = 0;
    
    // Đọc từ DB trước tiên
    if (farmHistory && farmHistory.marketStats && farmHistory.marketStats.bestCoinRate > 0) {
      dbCoinRate = parseFloat(farmHistory.marketStats.bestCoinRate);
    } else if (farmHistory && farmHistory.farmData && farmHistory.farmData.globalConfig && farmHistory.farmData.globalConfig.coinRate) {
      dbCoinRate = parseFloat(farmHistory.farmData.globalConfig.coinRate.replace(/,/g, ''));
    }

    let newCoinRate = (marketStats && marketStats.bestCoinRate > 0) ? parseFloat(marketStats.bestCoinRate) : 0;

    // Lấy giá trị tốt nhất (cao nhất) giữa DB và tính toán mới
    if (dbCoinRate > 0 && newCoinRate > 0) {
      coinRateValue = Math.max(dbCoinRate, newCoinRate);
    } else if (dbCoinRate > 0) {
      coinRateValue = dbCoinRate;
    } else if (newCoinRate > 0) {
      coinRateValue = newCoinRate;
    }
    
    // Cập nhật lại vào marketStats để lưu vào DB tiếp tục
    marketStats.bestCoinRate = coinRateValue;

    // Create shared cost calculator
    const calculator = createCostCalculator(coinRateValue, marketPrices);
    const html = await chapterRes.text();
    const $c = cheerio.load(html);

    let hasVipAccess = false;

    // Scrape global config from land and boost pages
    let globalConfig = {
      coinRate: coinRateValue.toString(),
      island: null,
      tax: null
    };

    if (boostRes.ok) {
      const boostHtml = await boostRes.text();
      if (boostHtml.includes('VIP Access')) {
        hasVipAccess = true;
      }
    }

    let coinDeliveries = [];

    if (landRes.ok) {
      const landHtml = await landRes.text();
      const $l = cheerio.load(landHtml);
      $l('tr').each((i, el) => {
        const td1 = $l(el).find('td').eq(0).text().trim();
        const td2 = $l(el).find('td').eq(1).text().trim();
        if (td1 === 'Island') globalConfig.island = td2;
        if (td1 === 'Resource Tax') globalConfig.tax = td2;
      });

      const h4Name = $l('td.ta-left.h4 a b').first().text().trim();
      if (h4Name) {
        globalConfig.playerName = h4Name;
      }

      let bumpkinInfo = { level: null, experience: null, avatar: null };
      const avatarImg = $l('img[src*="bumpkin_image"]').attr('src');
      if (avatarImg) bumpkinInfo.avatar = avatarImg;
      const levelText = $l('h5:contains("Level") b').text();
      if (levelText) bumpkinInfo.level = parseInt(levelText);
      const expText = $l('div:contains("Experience") b').text();
      if (expText) bumpkinInfo.experience = parseInt(expText);
      if (gameData && gameData.bumpkin && gameData.bumpkin.equipped) {
        const dynamicUri = buildBumpkinUri(gameData.bumpkin.equipped);
        if (dynamicUri && dynamicUri !== '0_v1_0') {
          bumpkinInfo.avatar = `https://animations.sunflower-land.com/bumpkin_image/${dynamicUri}/100`;
        }
      }
      globalConfig.bumpkin = bumpkinInfo;


      
      // Pirate Chest parsing (kept minimal as it's not in public gameData yet)
      $l('.cchecklist, .badge').each((j, sEl) => {
        const text = $l(sEl).text().trim().replace(/\s+/g, ' ');
        if (text.includes('Pirate Chest')) {
          const isSuccess = $l(sEl).hasClass('text-bg-success') || $l(sEl).find('.text-bg-success').length > 0;
          globalConfig.pirateChest = isSuccess ? 'success' : 'info';
        }
      });
    }

    // Fallback: If sfl.world scraping fails (e.g. Cloudflare block), preserve the last known coin rate from DB.
    if (!globalConfig.coinRate && farmHistory?.farmData?.globalConfig?.coinRate) {
      globalConfig.coinRate = farmHistory.farmData.globalConfig.coinRate;
    }

    let summary = {
      dailyChest: globalConfig.pirateChest ? { status: globalConfig.pirateChest } : null,
      desertDigging: null,
      poppyBounty: null,
      table: [],
      deliveryTotals: { tickets: 0, cost: '', claimed: 0 }
    };
    let deliveries = [];
    let chores = [];
    let bounties = [];
    let animals = [];

    
    // --- 1. Deliveries & Coin Deliveries (API) ---
    if (gameData && gameData.delivery && gameData.delivery.orders) {
      gameData.delivery.orders.forEach((sflOrder, j) => {
        let npcName = sflOrder.from.charAt(0).toUpperCase() + sflOrder.from.slice(1);
        let isTicketNpc = TICKET_REWARDS.hasOwnProperty(npcName.toLowerCase());
        
        let reqItems = [];
        let allEnough = true;
        
        if (sflOrder.items && Object.keys(sflOrder.items).length > 0) {
          for (const [itemName, total] of Object.entries(sflOrder.items)) {
            let currAmt = 0;
            if (itemName.toLowerCase() === 'coins') {
              currAmt = parseFloat(gameData.coins || gameData.balance || 0);
            } else {
              const inv = gameData.inventory;
              if (inv) {
                let invKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
                if (invKey) currAmt = parseFloat(inv[invKey]) || 0;
              }
            }
            const enough = currAmt >= total;
            if (!enough) allEnough = false;
            reqItems.push({ name: itemName, total, completed: currAmt, enough, img: null });
          }
        }
        if (sflOrder.coins && sflOrder.coins > 0) {
          let currAmt = parseFloat(gameData.coins || gameData.balance || 0);
          const enough = currAmt >= sflOrder.coins;
          if (!enough) allEnough = false;
          reqItems.push({ name: 'coins', total: sflOrder.coins, completed: currAmt, enough, img: null });
        }
        
        let rewardAmount = 0;
        let rewardType = 'Unknown';
        let exactRewardStr = '';
        
        if (sflOrder.reward.items && Object.keys(sflOrder.reward.items).length > 0) {
          const itemName = Object.keys(sflOrder.reward.items)[0];
          rewardAmount = sflOrder.reward.items[itemName];
          rewardType = itemName;
          exactRewardStr = `${rewardAmount} ${itemName}`;
        } else if (sflOrder.reward.coins > 0) {
          rewardAmount = sflOrder.reward.coins;
          rewardType = 'Coins';
          exactRewardStr = `${rewardAmount} Coins`;
        } else if (sflOrder.reward.sfl > 0) {
          rewardAmount = sflOrder.reward.sfl;
          rewardType = 'SFL';
          exactRewardStr = `${rewardAmount} SFL`;
        } else if (sflOrder.reward.tickets > 0 || isTicketNpc) {
          rewardAmount = sflOrder.reward.tickets || 0;
          rewardType = 'Shiny Feather';
          exactRewardStr = `${rewardAmount} Shiny Feather`;
        }
        
        // Ticket Buff logic
        if (rewardType === 'Shiny Feather') {
          let calculatedTickets = TICKET_REWARDS[npcName.toLowerCase()] || 0;
          if (inventory.hasVip) calculatedTickets += 2;
          let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
          calculatedTickets += ticketClothesBuff;
          
          let isDouble = false;
          if (gameData.calendar && gameData.calendar.dates) {
            const todayStr = new Date().toISOString().substring(0, 10);
            const todayEvent = gameData.calendar.dates.find(d => d.date === todayStr && d.name === 'doubleDelivery');
            if (todayEvent) {
               const npcData = gameData.npcs && gameData.npcs[npcName.toLowerCase()];
               let alreadyCompletedToday = false;
               if (npcData && npcData.deliveryCompletedAt) {
                  const completedDateStr = new Date(npcData.deliveryCompletedAt).toISOString().substring(0, 10);
                  if (completedDateStr === todayStr) alreadyCompletedToday = true;
               }
               if (!alreadyCompletedToday) {
                  isDouble = true;
                  calculatedTickets *= 2;
               }
            }
          }
          rewardAmount = calculatedTickets;
          exactRewardStr = `${rewardAmount} Shiny Feather${isDouble ? ' (x2)' : ''}`;
        }
        
        // Coin/SFL Buff logic
        if (rewardType === 'Coins' || rewardType === 'SFL') {
             let baseReward = rewardAmount;
             let bonus = 0;
             const skills = gameData.bumpkin?.skills || {};
             const equippedItems = [];
             if (gameData.bumpkin?.equipped) {
                 equippedItems.push(...Object.values(gameData.bumpkin.equipped));
             }
             if (gameData.farmHands?.bumpkins) {
                 for (const hand of Object.values(gameData.farmHands.bumpkins)) {
                     if (hand.equipped) {
                         equippedItems.push(...Object.values(hand.equipped));
                     }
                 }
             }
             let isFood = false;
             let isBakery = false;
             let isCake = false;
             for (const itemName of Object.keys(sflOrder.items || {})) {
                 if (foodRecipes[itemName]) {
                     isFood = true;
                     if (foodRecipes[itemName].building === 'Bakery') {
                         isBakery = true;
                     }
                     if (itemName.toLowerCase().includes("cake")) {
                         isCake = true;
                     }
                 }
             }
             
             if (isFood && skills["Nom Nom"]) {
                 const rank = skills["Nom Nom"];
                 if (rank === 1) bonus += 0.1;
                 else if (rank === 2) bonus += 0.3;
                 else if (rank >= 3) bonus += 0.5;
             }
             
             if (isCake && equippedItems.includes("Chef Apron")) bonus += 0.2;
             if (isBakery && equippedItems.includes("Chef Hat")) bonus += 0.1;
             
             if (rewardType === 'Coins') {
                 const npcKey = npcName.toLowerCase();
                 if (npcKey === "betty" && skills["Betty's Friend"]) {
                     const rank = skills["Betty's Friend"];
                     if (rank === 1) bonus += 0.3;
                     else if (rank === 2) bonus += 0.45;
                     else if (rank >= 3) bonus += 0.6;
                 }
                 if (npcKey === "victoria" && skills["Victoria's Secretary"]) {
                     const rank = skills["Victoria's Secretary"];
                     if (rank === 1) bonus += 0.5;
                     else if (rank === 2) bonus += 0.75;
                     else if (rank >= 3) bonus += 1.0;
                 }
                 if (npcKey === "corale" && skills["Fishy Fortune"]) {
                     const rank = skills["Fishy Fortune"];
                     if (rank === 1) bonus += 1.0;
                     else if (rank === 2) bonus += 1.25;
                     else if (rank >= 3) bonus += 1.5;
                 }
                 if (npcKey === "blacksmith" && skills["Forge-Ward Profits"]) {
                     const rank = skills["Forge-Ward Profits"];
                     if (rank === 1) bonus += 0.2;
                     else if (rank === 2) bonus += 0.3;
                     else if (rank >= 3) bonus += 0.4;
                 }
                 if (npcKey === "tango" && skills["Fruity Profit"]) {
                     const rank = skills["Fruity Profit"];
                     if (rank === 1) bonus += 0.5;
                     else if (rank === 2) bonus += 0.75;
                     else if (rank >= 3) bonus += 1.0;
                 }
             }
             
             rewardAmount = baseReward * (1 + bonus);
             rewardAmount = Math.round(rewardAmount * 10000) / 10000;
             exactRewardStr = `${rewardAmount} ${rewardType}`;
        }
        
        let claimed = sflOrder.completedAt ? true : false;
        let status = claimed ? 'claimed' : (reqItems.length === 0 ? 'inactive' : (allEnough ? 'ready' : 'not_ready'));
        
        let canSkip = false;
        let skipWaitTime = 0;
        if (!claimed && reqItems.length > 0 && sflOrder.createdAt) {
           const now = new Date();
           const lastReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
           if (sflOrder.createdAt < lastReset.getTime()) {
              canSkip = true;
           } else {
              skipWaitTime = (lastReset.getTime() + 24 * 60 * 60 * 1000) - Date.now();
           }
        }
        if (canSkip && status === 'not_ready') status = 'can_skip';
        
        let tP2P = 0;
        if (sflOrder.items && Object.keys(sflOrder.items).length > 0) {
          tP2P = calculator.getCostForItems(sflOrder.items);
        }
        
        const npcStats = gameData.npcs && gameData.npcs[npcName.toLowerCase()] ? gameData.npcs[npcName.toLowerCase()] : {};
        
        if (rewardType === 'Coins' || rewardType === 'SFL') {
           coinDeliveries.push({
              type: rewardType.toLowerCase(),
              npcName: npcName,
              reqItems: reqItems,
              rewardAmount: rewardAmount,
              totalP2PCost: tP2P,
              status: status,
              deliveryCount: npcStats.deliveryCount || 0,
              skippedCount: npcStats.skippedCount || 0,
              canSkip: canSkip,
              skipWaitTime: skipWaitTime
           });
        } else {
           let costPerTicket = '';
           if (tP2P > 0 && rewardAmount > 0) {
             costPerTicket = Number((tP2P / rewardAmount).toFixed(5)).toString();
           }
           let tMarket = tP2P ? Number((tP2P / 0.9).toFixed(5)) : null;
           let avg = (tP2P && rewardAmount > 0) ? Number((tP2P / rewardAmount).toFixed(5)) : null;
           
           deliveries.push({
              id: j,
              npcName,
              reqItems,
              reward: exactRewardStr,
              rewardType,
              rewardAmount,
              totalCost: tP2P,
              totalP2PCost: tP2P,
              totalMarketCost: tMarket,
              avgCost: avg,
              costPerTicket,
              status,
              canSkip,
              skipWaitTime
           });
           
           summary.deliveryTotals.tickets += rewardAmount;
           if (claimed) summary.deliveryTotals.claimed += rewardAmount;
        }
      });
    }

    // --- 2. Weekly Chores (API) ---
    if (gameData && gameData.choreBoard && gameData.choreBoard.chores) {
      let items = [];
      const choresList = Object.values(gameData.choreBoard.chores);
      choresList.forEach(c => {
         const choreFunc = choreFunctions[c.name];
         let total = choreFunc ? choreFunc.requirement : (parseInt(c.name.match(/\d+/)?.[0] || '1'));
         let completed = 0;
         if (c.completedAt) {
            completed = total;
         } else if (choreFunc) {
            const rawProgress = choreFunc.progress(gameData) || 0;
            const initialProgress = c.initialProgress || 0;
            completed = rawProgress - initialProgress;
         }
         if (completed < 0) completed = 0;
         if (completed > total) completed = total;
         
         let status = c.completedAt ? 'claimed' : (completed >= total ? 'ready' : 'not_ready');
         
         let rewardAmount = 0;
         let rewardType = 'Unknown';
         if (c.reward && c.reward.items && Object.keys(c.reward.items).length > 0) {
             const itemName = Object.keys(c.reward.items)[0];
             rewardAmount = c.reward.items[itemName];
             rewardType = itemName;
         } else if (c.reward && c.reward.coins > 0) {
             rewardAmount = c.reward.coins;
             rewardType = 'Coins';
         }
         
         if (rewardType !== 'Shiny Feather') return;

         if (rewardType === 'Shiny Feather') {
            let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
            rewardAmount += ticketClothesBuff;
            if (inventory.hasVip) rewardAmount += 2;
         }
         
         items.push({ name: c.name, completed, total, reward: rewardAmount, rewardType, status });
      });
      if (items.length > 0) {
        chores.push({ category: "Weekly Chores", items });
      }
    }

    // --- 3. Bounties & Animals (API) ---
    if (gameData && gameData.bounties && gameData.bounties.requests) {
      let completedBounties = (gameData.bounties.completed || []).map(c => c.id);
      const allReqs = gameData.bounties.requests;
      
      allReqs.forEach(req => {
        const isAnimal = req.name && (req.name.toLowerCase().includes('cow') || req.name.toLowerCase().includes('sheep') || req.name.toLowerCase().includes('chicken'));
        
        let rewardType = 'Unknown';
        let rewardAmount = 0;
        
        if (req.items && Object.keys(req.items).length > 0) {
           const keys = Object.keys(req.items);
           rewardType = keys[0];
           rewardAmount = req.items[rewardType];
        } else if (req.coins > 0) {
           rewardType = 'Coins';
           rewardAmount = req.coins;
        } else if (req.sfl > 0) {
           rewardType = 'SFL';
           rewardAmount = req.sfl;
        } else {
           rewardType = 'Shiny Feather';
        }
        
        if (rewardType === 'Shiny Feather') {
           let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
           rewardAmount += ticketClothesBuff;
        }
        
        if (rewardType !== "Shiny Feather") return;
        const isCompleted = completedBounties.includes(req.id);
        
        if (isAnimal) {
            const level = req.level ? `Lv ${req.level}` : 'Lv ?';
            animals.push({
                id: req.id,
                animalName: req.name.split(' ')[0],
                level: level,
                reward: rewardAmount,
                rewardType: rewardType,
                status: isCompleted ? 'claimed' : 'ready'
            });
            return;
        }
        
        let total = req.quantity || 1;
        let completed = 0;
        if (gameData.inventory && gameData.inventory[req.name]) {
           completed = parseFloat(gameData.inventory[req.name]);
        }
        if (completed > total) completed = total;
        
        let status = isCompleted ? 'claimed' : (completed >= total ? 'ready' : 'not_ready');
        
        bounties.push({
          id: req.id,
          name: req.name,
          completed: isCompleted ? total : completed,
          total: total,
          reward: rewardAmount,
          rewardType: rewardType,
          status: status
        });
      });
      
      // Poppy Bonus
      let poppyStatus = 'not_ready';
      const currentWeekStr = getISOYearWeek(new Date());
      let claimedThisWeek = false;
      if (gameData.bounties.bonusClaimedAt > 0) {
         const bonusClaimedWeekStr = getISOYearWeek(new Date(gameData.bounties.bonusClaimedAt));
         if (bonusClaimedWeekStr === currentWeekStr) {
            claimedThisWeek = true;
         }
      }
      
      if (claimedThisWeek) {
        poppyStatus = 'claimed';
      } else if (gameData.bounties.requests.length > 0) {
        const allDone = gameData.bounties.requests.every(r => completedBounties.includes(r.id));
        if (allDone) poppyStatus = 'ready';
      }
      
      bounties.push({
        id: 'poppy_bonus',
        name: 'Poppy Bounty Bonus',
        completed: poppyStatus === 'claimed' ? 1 : 0,
        total: 1,
        reward: 100,
        rewardType: 'Shiny Feather',
        status: poppyStatus
      });
    }

    // --- End API Extractions ---


if (hasVipAccess) inventory.hasVip = true;
    if (gameData) {
      const currentSeason = 'Ascension Age'; // Hardcoded for current SFL ticket season
      const chapterBoosts = CHAPTER_TICKET_BOOST_ITEMS[currentSeason];
      if (chapterBoosts) {
        if (checkIsEquipped(gameData, chapterBoosts.basic)) inventory.hasHat = true;
        if (checkIsEquipped(gameData, chapterBoosts.rare)) inventory.hasArmor = true;
        if (checkIsEquipped(gameData, chapterBoosts.epic)) inventory.hasPants = true;
      }
      if (gameData.vip && gameData.vip.expiresAt && gameData.vip.expiresAt > Date.now()) {
        inventory.hasVip = true;
      }
      if (gameData.inventory && gameData.inventory['Shiny Feather']) {
        inventory['Shiny Feather'] = Number(gameData.inventory['Shiny Feather']) || 0;
      }
    } else if (publicData && publicData.inventory) {
      if (publicData.inventory['Shiny Feather']) {
        inventory['Shiny Feather'] = Number(publicData.inventory['Shiny Feather']) || 0;
      }
    }



    // marketStats and coinRateValue are already computed above


    chores = chores.map(category => {
      return {
        ...category,
        items: category.items.map(item => {
          let choreCost = 0;
          let foundKey = null;
          let hasCost = false;

          // Check if it's a tool-based task
          if (item.name.match(/Craft\s+\d+\s+Fishing Rods/i) || item.name.match(/Fish\s+\d+\s+times/i)) {
            foundKey = 'Fishing Rod';
            choreCost = Number((calculator.getUniversalCost('Rod') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Craft\s+\d+\s+Mariner Pots?/i)) {
            foundKey = 'Mariner Pot';
            choreCost = Number((calculator.getUniversalCost('Mariner Pot') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Craft\s+\d+\s+Crab Pots?/i)) {
            foundKey = 'Crab Pot';
            choreCost = Number((calculator.getUniversalCost('Crab Pot') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Chop\s+\d+\s+Trees/i)) {
            foundKey = 'Axe';
            choreCost = Number((calculator.getUniversalCost('Axe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\s+\d+\s+Stones/i)) {
            foundKey = 'Pickaxe';
            choreCost = Number((calculator.getUniversalCost('Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\s+\d+\s+Iron/i)) {
            foundKey = 'Stone Pickaxe';
            choreCost = Number((calculator.getUniversalCost('Stone Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\s+\d+\s+Gold/i)) {
            foundKey = 'Iron Pickaxe';
            choreCost = Number((calculator.getUniversalCost('Iron Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Mine\s+\d+\s+Crimstone/i)) {
            foundKey = 'Gold Pickaxe';
            choreCost = Number((calculator.getUniversalCost('Gold Pickaxe') * item.total).toFixed(5));
            hasCost = true;
          } else if (item.name.match(/Dig\s+\d+\s+times/i)) {
            foundKey = 'Sand Shovel';
            choreCost = Number((calculator.getUniversalCost('Sand Shovel') * item.total).toFixed(5));
            hasCost = true;
          }

          // Check if it's a crop or fruit task
          let matchCrop = item.name.match(/Harvest\s+([A-Za-z\s]+)\s+\d+\s+times/i);
          let matchPick = item.name.match(/Pick\s+\d+\s+([A-Za-z\s]+)/i);
          let matchGrow = item.name.match(/Grow\s+([A-Za-z\s]+)\s+\d+\s+times/i);

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

            let seedName = `${singularName} Seed`;
              if (flowerRecipes[singularName]) {
                seedName = flowerRecipes[singularName].seed;
              }
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

          // If not a tool task, fall back to crafting/cooking/sellable costs via calculator
          const matchResult = item.name.match(/(?:Sell|Cook|Chop|Mine|Harvest|Pick|Grow|Craft|Eat|Prepare)\s+(\d+)?\s*([A-Za-z\s'-]+)/i);
          if (matchResult) {
             const actionVerb = item.name.match(/^(Sell|Cook|Chop|Mine|Harvest|Pick|Grow|Craft|Eat|Prepare)/i)?.[1]?.toLowerCase() || '';
             let itemNameStr = matchResult[2].trim();
             if (itemNameStr.toLowerCase().endsWith(' times')) itemNameStr = itemNameStr.slice(0, -6).trim();
             
             let unitCost = 0;
             const isFoodAction = ['cook', 'eat', 'prepare', 'sell'].includes(actionVerb);
             
             let titleCase = itemNameStr.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
             const singular = titleCase.toLowerCase().endsWith('s') ? titleCase.slice(0, -1) : titleCase;
             let titleSingular = singular.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

             if (isFoodAction) {
                 if (marketPrices[titleCase] > 0) {
                     unitCost = marketPrices[titleCase] * 0.9;
                     itemNameStr = titleCase;
                 } else if (marketPrices[titleSingular] > 0) {
                     unitCost = marketPrices[titleSingular] * 0.9;
                     itemNameStr = titleSingular;
                 }
             }

             if (unitCost === 0) {
                 unitCost = calculator.getUniversalCost(titleCase);
                 if (unitCost > 0) itemNameStr = titleCase;
             }
             if (unitCost === 0) {
                 unitCost = calculator.getUniversalCost(titleSingular);
                 if (unitCost > 0) itemNameStr = titleSingular;
             }
             
             if (unitCost > 0) {
                foundKey = itemNameStr;
                choreCost = Number((unitCost * item.total).toFixed(5));
                return {
                  ...item,
                  itemType: foundKey,
                  unitCost: unitCost,
                  choreCost: choreCost,
                  totalP2PCost: choreCost,
                  totalMarketCost: Number((choreCost / 0.9).toFixed(5)),
                  avgCost: item.reward > 0 ? Number((choreCost / item.reward).toFixed(5)) : null
                };
             }
          }
          return item;
        })
      };
    });

    bounties = bounties.map(b => {
      let isFromScrape = false;
      let itemName = b.name ? b.name.trim() : '';
      let itemMultiplier = 1;

      const nameMatch = itemName.match(/(?:Sell|Cook|Chop|Mine|Harvest|Pick|Grow|Craft|Eat|Prepare)\s+(\d+)?\s*([A-Za-z\s'-]+)/i);
      let actionVerb = '';
      if (nameMatch) {
        actionVerb = itemName.match(/^(Sell|Cook|Chop|Mine|Harvest|Pick|Grow|Craft|Eat|Prepare)/i)?.[1]?.toLowerCase() || '';
        if (nameMatch[1]) itemMultiplier = parseInt(nameMatch[1], 10);
        itemName = nameMatch[2].trim();
        if (itemName.toLowerCase().endsWith(' times')) itemName = itemName.slice(0, -6).trim();
      }

      let effectiveTotal = Math.max(b.total || 0, itemMultiplier);
      let unitCost = 0;
      
      let titleCase = itemName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const singular = titleCase.toLowerCase().endsWith('s') ? titleCase.slice(0, -1) : titleCase;
      let titleSingular = singular.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      if (['cook', 'eat', 'prepare', 'sell'].includes(actionVerb)) {
          if (marketPrices[titleCase] > 0) {
              unitCost = marketPrices[titleCase] * 0.9;
              itemName = titleCase;
          } else if (marketPrices[titleSingular] > 0) {
              unitCost = marketPrices[titleSingular] * 0.9;
              itemName = titleSingular;
          }
      }

      if (unitCost === 0) {
         unitCost = calculator.getUniversalCost(titleCase);
         if (unitCost > 0) itemName = titleCase;
      }
      if (unitCost === 0) {
         unitCost = calculator.getUniversalCost(titleSingular);
         if (unitCost > 0) itemName = titleSingular;
      }

      console.log(`[BOUNTY DEBUG] item: ${b.name}, parsedName: ${itemName}, unitCost: ${unitCost}`);

      if (unitCost > 0) {
        let pPrice = unitCost;
        let mPrice = Number((unitCost / 0.9).toFixed(5));
        let totalPPrice = Number((pPrice * effectiveTotal).toFixed(5));
        let avgCost = b.reward > 0 ? Number((totalPPrice / b.reward).toFixed(5)) : null;

        return {
          ...b,
          marketPrice: mPrice,
          p2pPrice: pPrice,
          totalP2PCost: totalPPrice,
          avgCost: avgCost
        };
      }
      return b;
    });

    
    // Merge Coin deliveries with Ticket deliveries to pass into recordFarmHistory
    const allDeliveries = deliveries.map(d => ({...d, isCoinType: false})).concat(
        (coinDeliveries || []).map(d => ({...d, isCoinType: true, status: d.status, rewardAmount: d.rewardAmount, rewardType: d.type === 'sfl' ? 'SFL' : 'Coins'}))
    );
    await recordFarmHistory(farmId, allDeliveries, chores, bounties, animals, summary, inventory, gameData).catch(console.error);

    // Save marketStats to history collection directly
    try {
      if (getHistoryCollection()) {
        await getHistoryCollection().updateOne(
          { _id: farmId },
          { $set: { marketStats } }
        );
      }
    } catch (e) {
      console.error("Error saving marketStats:", e);
    }

    // Ticket deliveries are now accurately calculated in the parsing loop so no override is needed

      let ascensionMilestoneTickets = 0;
      if (gameData && gameData.farmActivity && gameData.farmActivity['Ascension Age Points Earned'] > 0) {
        const points = gameData.farmActivity['Ascension Age Points Earned'];
        const hasVip = gameData.inventory && gameData.inventory['Ascension Age Banner'] > 0;
        
        for (const milestone of ascensionMilestones) {
          if (points >= milestone.points) {
            if (milestone.free && milestone.free.items && milestone.free.items['Shiny Feather']) {
              ascensionMilestoneTickets += milestone.free.items['Shiny Feather'];
            }
            if (hasVip && milestone.premium && milestone.premium.items && milestone.premium.items['Shiny Feather']) {
              ascensionMilestoneTickets += milestone.premium.items['Shiny Feather'];
            }
          }
        }
      }

      const computedCosts = {};
      const allKeys = new Set([
        ...Object.keys(marketPrices),
        ...Object.keys(calculator.seedPrices),
        ...Object.keys(calculator.flowerRecipes),
        ...Object.keys(calculator.dollRecipes),
        ...Object.keys(calculator.fishingRecipes),
        ...Object.keys(calculator.fishData),
        ...Object.keys(calculator.toolPrices),
        ...Object.keys(calculator.foodRecipes),
        ...Object.keys(calculator.sellPrices),
        'Crab Pot', 'Mariner Pot', 'Oil'
      ]);
      
      for (const k of allKeys) {
         computedCosts[k] = calculator.getUniversalCost(k);
      }

      // Rebuild Summary Panel natively from API if gameData is present
      if (gameData) {
        let choresTotal = 0, choresClaimed = 0;
        chores.forEach(c => {
          c.items.forEach(item => {
            choresTotal++;
            if (item.status === 'claimed') choresClaimed++;
          });
        });
        
        let bountiesTotal = bounties.length;
        let bountiesClaimed = bounties.filter(b => b.status === 'claimed').length;
        
        let animalsTotal = animals.length;
        let animalsClaimed = animals.filter(a => a.status === 'claimed').length;
        
        let deliveriesTotal = deliveries.length;
        let deliveriesClaimed = deliveries.filter(d => d.status === 'claimed').length;

        summary.table = [
          { source: 'Deliveries', total: deliveriesTotal, claimed: deliveriesClaimed, left: deliveriesTotal - deliveriesClaimed, percent: `${Math.round((deliveriesClaimed / (deliveriesTotal || 1)) * 100)}%` },
          { source: 'Chores', total: choresTotal, claimed: choresClaimed, left: choresTotal - choresClaimed, percent: `${Math.round((choresClaimed / (choresTotal || 1)) * 100)}%` },
          { source: 'Bounties', total: bountiesTotal, claimed: bountiesClaimed, left: bountiesTotal - bountiesClaimed, percent: `${Math.round((bountiesClaimed / (bountiesTotal || 1)) * 100)}%` },
          { source: 'Animals', total: animalsTotal, claimed: animalsClaimed, left: animalsTotal - animalsClaimed, percent: `${Math.round((animalsClaimed / (animalsTotal || 1)) * 100)}%` }
        ];

        if (gameData.dailyRewards) {
          const now = new Date();
          const todayUTCStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().substring(0, 10);
          const collectedAt = gameData.dailyRewards.chest?.collectedAt;
          const collectedDateStr = collectedAt ? new Date(collectedAt).toISOString().substring(0, 10) : '';
          
          summary.dailyChest = {
            text: `${gameData.dailyRewards.streaks || 0} Streaks`,
            status: (collectedDateStr === todayUTCStr) ? 'success' : 'danger'
          };
        }
        
        if (gameData.desert && gameData.desert.digging) {
          summary.desertDigging = {
            text: `Streaks ${gameData.desert.digging.streak?.count || 0}`,
            status: 'success'
          };
        }
      }

      res.json({
        success: true,
        data: {
          ...publicData,
          summary,
          marketStats,
          scrapedDeliveries: deliveries,
          coinDeliveries: coinDeliveries,
          chores,
          bounties,
          animals,
          inventory,
          globalConfig,
          gameData,
          ascensionMilestoneTickets,
          computedCosts,
          prices: { 
            ...marketPrices, 
            'Crab Pot': calculator.getUniversalCost('Crab Pot'), 
            'Mariner Pot': calculator.getUniversalCost('Mariner Pot') 
          }
        }
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for Vercel Cron


module.exports = router;
