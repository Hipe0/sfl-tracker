const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { verifyToken } = require('../middlewares/auth.cjs');
const { getHistoryCollection } = require('../config/db.cjs');
const { recordFarmHistory } = require('../services/historyService.cjs');
const path = require('path');
const { sflCommunityQueue, sflWorldQueue } = require('../utils/apiQueue.cjs');
const { createCostCalculator } = require('../utils/costCalculator.cjs');

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
// Helper for scraper (if needed)
const getISOWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const getISOYearWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
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

    // AUTO-UPDATE SFL.WORLD CACHE
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
    if (apiKey) {
      try {
        const communityRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
          headers: { 'x-api-key': apiKey }
        }));
        if (communityRes.status === 429) {
          return res.status(429).json({ error: "API Sunflower Land đang bị quá tải (Rate Limit). Vui lòng thử lại sau!" });
        }
        if (communityRes.ok) {
          const resData = await communityRes.json();
          if (resData && resData.farm) {
            gameData = resData.farm;

            // Check VIP status from gameData.vip subscription
            if (gameData.vip && gameData.vip.expiresAt) {
              inventory.hasVip = gameData.vip.expiresAt > Date.now();
            }

            // Check Bonus Outfits dynamically from currently EQUIPPED items for the current season
            if (gameData) {
              const currentSeason = 'Ascension Age'; // Hardcoded for current SFL ticket season
              const chapterBoosts = CHAPTER_TICKET_BOOST_ITEMS[currentSeason];
              inventory.hasHat = false; inventory.hasArmor = false; inventory.hasPants = false;
              if (chapterBoosts) {
                if (checkIsEquipped(gameData, chapterBoosts.basic)) inventory.hasHat = true;
                if (checkIsEquipped(gameData, chapterBoosts.rare)) inventory.hasArmor = true;
                if (checkIsEquipped(gameData, chapterBoosts.epic)) inventory.hasPants = true;
              }
            }
          }
        }
      } catch (e) {
        console.error("SFL Community API error", e);
      }
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


      $l('.accordion-item').each((i, el) => {
        const titleText = $l(el).find('.accordion-button').text().trim();
        if (titleText === 'Checklist') {
          $l(el).find('.cchecklist, .badge').each((j, sEl) => {
            const text = $l(sEl).text().trim().replace(/\s+/g, ' ');
            if (text.includes('Pirate Chest')) {
              const isSuccess = $l(sEl).hasClass('text-bg-success') || $l(sEl).find('.text-bg-success').length > 0;
              globalConfig.pirateChest = isSuccess ? 'success' : 'info';
            }
          });
        }

        // 2.5 Delivery for Coins & Flower (Scraped from Main Page)
        if (titleText.includes('Delivery for Coins') || titleText.includes('Delivery for Flower') || titleText.includes('Delivery for SFL')) {
          const type = titleText.includes('Coins') ? 'coins' : 'sfl';
          $l(el).find('.accordion-body table.m-bottom-10').each((j, tableEl) => {
            const trEl = $l(tableEl).find('tbody > tr').first();
            if (trEl.length === 0) return;

            const npcTd = trEl.find('td').first();
            let npcName = 'Unknown';
            if (npcTd.length > 0 && npcTd.find('img').length > 0) {
              const npcImg = npcTd.find('img').attr('title') || npcTd.find('img').attr('alt');
              if (npcImg) {
                npcName = npcImg.charAt(0).toUpperCase() + npcImg.slice(1);
              } else {
                npcName = $l(tableEl).find('thead th').first().text().trim();
              }
            }

            const itemsTd = trEl.find('td').eq(1);
            const reqItems = [];
            itemsTd.find('.badge').each((k, bEl) => {
              const itemName = $l(bEl).find('div').first().text().trim() || $l(bEl).text().trim().split('\n')[0].trim();
              const bEl2 = $l(bEl).find('b');
              const total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
              const imgEl = $l(bEl).find('img').first();
              const imgSrc = imgEl.length > 0 ? imgEl.attr('src') : null;

              let currAmt = 0;
              const inv = (gameData && gameData.inventory) ? gameData.inventory : ((farmHistory && farmHistory.cached_inventory) ? farmHistory.cached_inventory : inventory);
              if (inv) {
                let invKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
                if (invKey) {
                  currAmt = parseFloat(inv[invKey]) || 0;
                }
              }

              reqItems.push({
                name: itemName,
                total,
                completed: currAmt,
                enough: currAmt >= total,
                img: imgSrc ? `https://sfl.world${imgSrc}` : null
              });
            });

            // Find reward
            const rTrEl = $l(tableEl).find('tbody > tr').eq(1);
            let rewardAmount = 0;
            let isClaimed = false;
            if (rTrEl.length > 0) {
              const rText = rTrEl.text().trim();
              if (rText.includes('Claimed')) isClaimed = true;
              rewardAmount = parseFloat(rTrEl.find('td').eq(1).text().replace(/[^0-9.]/g, '')) || 0;
            }

            // Calculate P2P Cost using internal calculator (replaces HTML scraping)
            let totalP2PCost = 0;
            const ordersList = (gameData && gameData.delivery && gameData.delivery.orders) || (farmHistory && farmHistory.cached_orders) || [];
            const sflOrder = ordersList.find(o => o.from.toLowerCase() === npcName.toLowerCase());
            if (sflOrder && sflOrder.items && Object.keys(sflOrder.items).length > 0) {
              totalP2PCost = calculator.getCostForItems(sflOrder.items);
            }

            const apiNpc = (gameData && gameData.npcs && gameData.npcs[npcName.toLowerCase()]) || null;
            let histNpc = (farmHistory && farmHistory.npc_stats && farmHistory.npc_stats[npcName.toLowerCase()]) || null;
            if (typeof histNpc === 'number') {
              histNpc = { deliveryCount: histNpc, skippedCount: 0 };
            }
            const npcStats = apiNpc || histNpc || {};
            let status = isClaimed ? 'claimed' : 'ready';

            let canSkip = false;
            let skipWaitTime = 0;
            // Cross-verify with API completedAt
            if (sflOrder) {
              if (sflOrder.completedAt) {
                status = 'claimed';
              } else if (sflOrder.createdAt) {
                const now = new Date();
                const lastReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                if (sflOrder.createdAt < lastReset.getTime()) {
                  canSkip = true;
                } else {
                  skipWaitTime = (lastReset.getTime() + 24 * 60 * 60 * 1000) - Date.now();
                }
              }
            }

            if (sflOrder && sflOrder.items && Object.keys(sflOrder.items).length > 0) {
               const apiReqItems = [];
               for (const [itemName, total] of Object.entries(sflOrder.items)) {
                  let currAmt = 0;
                  if (itemName.toLowerCase() === 'coins') {
                      if (gameData) {
                          currAmt = parseFloat(gameData.coins || gameData.balance || 0);
                      }
                  } else {
                      const inv = (gameData && gameData.inventory) ? gameData.inventory : ((farmHistory && farmHistory.cached_inventory) ? farmHistory.cached_inventory : inventory);
                      if (inv) {
                        let invKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
                        if (invKey) {
                          currAmt = parseFloat(inv[invKey]) || 0;
                        }
                      }
                  }
                  apiReqItems.push({
                    name: itemName,
                    total: total,
                    completed: currAmt,
                    enough: currAmt >= total,
                    img: null
                  });
               }
               if (apiReqItems.length > 0) {
                   reqItems.length = 0;
                   reqItems.push(...apiReqItems);
               }
               
               if (sflOrder && sflOrder.reward) {
                 let baseReward = 0;
                 if (sflOrder.reward.sfl > 0) {
                     baseReward = sflOrder.reward.sfl;
                 } else if (sflOrder.reward.coins > 0) {
                     baseReward = sflOrder.reward.coins;
                 }
                 
                 if (baseReward > 0) {
                     let bonus = 0;
                     const skills = gameData?.bumpkin?.skills || {};
                     const equippedItems = [];
                     if (gameData?.bumpkin?.equipped) {
                         equippedItems.push(...Object.values(gameData.bumpkin.equipped));
                     }
                     if (gameData?.farmHands?.bumpkins) {
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
                     
                     if (isCake) {
                         if (equippedItems.includes("Chef Apron")) bonus += 0.2;
                     }
                     if (isBakery) {
                         if (equippedItems.includes("Chef Hat")) bonus += 0.1;
                     }
                     
                     // Coin Delivery Buffs
                     if (sflOrder.reward.coins > 0) {
                         const npcName = (sflOrder.from || "").toLowerCase();
                         if (npcName === "betty" && skills["Betty's Friend"]) {
                             const rank = skills["Betty's Friend"];
                             if (rank === 1) bonus += 0.3;
                             else if (rank === 2) bonus += 0.45;
                             else if (rank >= 3) bonus += 0.6;
                         }
                         if (npcName === "victoria" && skills["Victoria's Secretary"]) {
                             const rank = skills["Victoria's Secretary"];
                             if (rank === 1) bonus += 0.5;
                             else if (rank === 2) bonus += 0.75;
                             else if (rank >= 3) bonus += 1.0;
                         }
                         if (npcName === "corale" && skills["Fishy Fortune"]) {
                             const rank = skills["Fishy Fortune"];
                             if (rank === 1) bonus += 1.0;
                             else if (rank === 2) bonus += 1.25;
                             else if (rank >= 3) bonus += 1.5;
                         }
                         if (npcName === "blacksmith" && skills["Forge-Ward Profits"]) {
                             const rank = skills["Forge-Ward Profits"];
                             if (rank === 1) bonus += 0.2;
                             else if (rank === 2) bonus += 0.3;
                             else if (rank >= 3) bonus += 0.4;
                         }
                         if (npcName === "tango" && skills["Fruity Profit"]) {
                             const rank = skills["Fruity Profit"];
                             if (rank === 1) bonus += 0.5;
                             else if (rank === 2) bonus += 0.75;
                             else if (rank >= 3) bonus += 1.0;
                         }
                     }
                     
                     rewardAmount = baseReward * (1 + bonus);
                     rewardAmount = Math.round(rewardAmount * 10000) / 10000;
                 }
               }
            }

            coinDeliveries.push({
              type: type,
              npcName: npcName,
              reqItems: reqItems,
              rewardAmount: rewardAmount,
              totalP2PCost: totalP2PCost,
              status: status,
              deliveryCount: npcStats.deliveryCount || 0,
              skippedCount: npcStats.skippedCount || 0,
              canSkip: canSkip,
              skipWaitTime: skipWaitTime
            });
          });
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

    // Parse the Accordions
    $c('.accordion-item').each((i, el) => {
      const titleText = $c(el).find('.accordion-button').text().trim();
      const body = $c(el).find('.accordion-body');

      // 1. Summary
      if (titleText === 'Summary') {
        body.find('.cchecklist, .badge').each((j, sEl) => {
          let cloned = $c(sEl).clone();
          cloned.find('div').after(' ');
          const text = cloned.text().trim().replace(/\s+/g, ' ');

          const isDanger = $c(sEl).hasClass('text-bg-danger');
          const isSuccess = $c(sEl).hasClass('text-bg-success');
          const status = isDanger ? 'danger' : (isSuccess ? 'success' : 'info');

          if (text.includes('Daily chest')) summary.dailyChest = { text: text.replace('Daily chest', '').trim(), status };
          if (text.includes('Desert Digging')) summary.desertDigging = { text: text.replace('Desert Digging', '').trim().replace(/(Streaks\s+\d+)\s+/, '$1, '), status };
          if (text.includes('Poppy Bounty Bonus')) summary.poppyBounty = { text: text.replace('Poppy Bounty Bonus', '').trim(), status };
        });

        body.find('table.p-2 tr').each((j, tr) => {
          const tds = $c(tr).find('td');
          if (tds.length >= 4 && j > 0) {
            summary.table.push({
              source: $c(tds[0]).text().trim(),
              total: $c(tds[1]).text().trim(),
              claimed: $c(tds[2]).text().trim(),
              left: $c(tds[3]).text().trim(),
              percent: tds.length >= 5 ? $c(tds[4]).text().trim() : ''
            });
          }
        });
      }

      // 2. Delivery for Tickets
      if (titleText.includes('Delivery for Tickets')) {
        body.find('> table > tbody > tr').each((j, tr) => {
          const text = $c(tr).text();
          if (text.includes('Total Tickets')) summary.deliveryTotals.tickets = parseInt($c(tr).find('td').eq(1).text().replace(/[^0-9]/g, '')) || 0;
          if (text.includes('Total Cost P2P')) summary.deliveryTotals.cost = $c(tr).find('td').eq(1).text().trim().replace(/\s+/g, ' ');
          if (text.includes('Claimed')) summary.deliveryTotals.claimed = parseInt($c(tr).find('td').eq(1).text().replace(/[^0-9]/g, '')) || 0;
        });

        body.find('table.m-bottom-10').each((j, tableEl) => {
          const trEl = $c(tableEl).find('tbody > tr').first();
          if (trEl.length === 0) return;

          const npcTd = trEl.find('td').first();
          if (npcTd.length > 0 && npcTd.find('img').length > 0) {
            const npcImg = npcTd.find('img').attr('title');
            const npcName = npcImg ? npcImg.charAt(0).toUpperCase() + npcImg.slice(1) : $c(tableEl).find('thead th').first().text().trim();

            let claimed = false;
            let allEnough = true;

            const itemsTd = trEl.find('td').eq(1);
            const reqItems = [];
            let hasCheckCircle = false;
            itemsTd.find('.badge').each((k, bEl) => {
              let itemName = $c(bEl).find('div').first().text().trim();
              const smallEl = $c(bEl).find('small');
              const bEl2 = $c(bEl).find('b');
              const checkIcon = $c(bEl).find('.bi-check2-circle');

              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              } else if (checkIcon.length > 0) {
                const rawText = $c(bEl).text().trim();
                const numMatch = rawText.match(/\d+/);
                total = numMatch ? parseInt(numMatch[0]) : 1;
                completed = total;
                enough = true;
                hasCheckCircle = true;
                if (!itemName) {
                  const nameMatch = rawText.match(/^[a-zA-Z\s'-]+/);
                  if (nameMatch) itemName = nameMatch[0].trim();
                }
              }

              if (itemName) {
                const nameMatch = itemName.match(/^[a-zA-Z\s'-]+/);
                if (nameMatch) itemName = nameMatch[0].trim();
              }

              if (itemName && total > 0) {
                reqItems.push({ name: itemName, completed, total, enough });
              } else {
                let fallback = $c(bEl).text().trim().replace(/\s+/g, ' ');
                const fbNameMatch = fallback.match(/^[a-zA-Z\s'-]+/);
                if (fbNameMatch) fallback = fbNameMatch[0].trim();
                reqItems.push({ name: fallback, completed: 0, total: 0, enough: true });
              }
            });
            
            if (hasCheckCircle) claimed = true;

            let totalCost = '';
            let costPerTicket = '';
            let isTicketReward = false;
            
            const rewardTable = itemsTd.find('table.p-2');
            if (rewardTable.length > 0) {
              rewardTable.find('tr').each((k, rTrEl) => {
                const trText = $c(rTrEl).text();
                const trHtml = $c(rTrEl).html() || '';
                if (trText.includes('Claimed') || trText.includes('Reward')) {
                  if (trHtml.includes('tickets/')) isTicketReward = true;
                  if (trText.includes('Claimed')) claimed = true;
                  reward = $c(rTrEl).find('td').eq(1).text().trim();
                }
              });
            }

            let sflOrder = null;
            if (gameData && gameData.delivery && gameData.delivery.orders) {
              sflOrder = gameData.delivery.orders.find(o => o.from.toLowerCase() === npcName.toLowerCase());
            }

            let exactRewardStr = reward;
            let rewardType = 'Unknown';
            let rewardAmount = parseInt(reward.replace(/[^0-9]/g, '')) || 0;
            let isTicketNpc = TICKET_REWARDS.hasOwnProperty(npcName.toLowerCase());

            if (sflOrder) {
              if ((sflOrder.items && Object.keys(sflOrder.items).length > 0) || (sflOrder.coins && sflOrder.coins > 0)) {
                 const apiReqItems = [];
                 for (const [itemName, total] of Object.entries(sflOrder.items || {})) {
                    let currAmt = 0;
                    if (itemName.toLowerCase() === 'coins') {
                        if (gameData) {
                            currAmt = parseFloat(gameData.coins || gameData.balance || 0);
                        }
                    } else {
                        const inv = (gameData && gameData.inventory) ? gameData.inventory : ((farmHistory && farmHistory.cached_inventory) ? farmHistory.cached_inventory : inventory);
                        if (inv) {
                          let invKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
                          if (invKey) {
                            currAmt = parseFloat(inv[invKey]) || 0;
                          }
                        }
                    }
                    apiReqItems.push({
                      name: itemName,
                      total: total,
                      completed: currAmt,
                      enough: currAmt >= total,
                      img: null
                    });
                 }
                 if (sflOrder.coins && sflOrder.coins > 0) {
                     let currCoins = 0;
                     if (gameData) {
                         currCoins = parseFloat(gameData.coins || gameData.balance || 0);
                     }
                     apiReqItems.push({
                         name: 'coins',
                         total: sflOrder.coins,
                         completed: currCoins,
                         enough: currCoins >= sflOrder.coins,
                         img: null
                     });
                 }
                 if (apiReqItems.length > 0) {
                   reqItems.length = 0;
                   reqItems.push(...apiReqItems);
                 }
              }

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
              } else {
                rewardType = 'Shiny Feather';
                exactRewardStr = `${rewardAmount} Shiny Feather`;
              }
            } else {
              if (isTicketReward || isTicketNpc) {
                rewardType = 'Shiny Feather';
                exactRewardStr = `${rewardAmount} Shiny Feather`;
              } else {
                rewardType = 'Coins';
                rewardAmount = parseInt(reward.replace(/[^0-9]/g, '')) || 0;
                exactRewardStr = `${rewardAmount} Coins`;
              }
            }

            // --- RECALCULATE TICKETS ACCURATELY ---
            if (rewardType === 'Shiny Feather' && !exactRewardStr.includes('Coins') && !exactRewardStr.includes('SFL')) {
              let calculatedTickets = TICKET_REWARDS[npcName.toLowerCase()] || 0;
              
              if (inventory.hasVip) calculatedTickets += 2;
              
              let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
              calculatedTickets += ticketClothesBuff;
              
              let isDouble = false;
              if (gameData && gameData.calendar && gameData.calendar.dates) {
                const todayStr = new Date().toISOString().substring(0, 10); // UTC today
                const todayEvent = gameData.calendar.dates.find(d => d.date === todayStr);
                if (todayEvent && todayEvent.name === 'doubleDelivery') {
                   const npcData = gameData.npcs && gameData.npcs[npcName.toLowerCase()];
                   let alreadyCompletedToday = false;
                   if (npcData && npcData.deliveryCompletedAt) {
                      const completedDateStr = new Date(npcData.deliveryCompletedAt).toISOString().substring(0, 10);
                      if (completedDateStr === todayStr) {
                         alreadyCompletedToday = true;
                      }
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

            let status = claimed ? 'claimed' : (reqItems.length === 0 ? 'inactive' : (allEnough ? 'ready' : 'not_ready'));

            let canSkip = false;
            let skipWaitTime = 0;
            if (sflOrder && !claimed && reqItems.length > 0) {
               if (sflOrder.createdAt) {
                  const now = new Date();
                  const lastReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                  if (sflOrder.createdAt < lastReset.getTime()) {
                     canSkip = true;
                  } else {
                     skipWaitTime = (lastReset.getTime() + 24 * 60 * 60 * 1000) - Date.now();
                  }
               }
            }

            if (canSkip && status === 'not_ready') {
               status = 'can_skip';
            }

            let tP2P = 0;
            if (sflOrder && sflOrder.items && Object.keys(sflOrder.items).length > 0) {
              tP2P = calculator.getCostForItems(sflOrder.items);
            }
            if (tP2P > 0 && rewardAmount > 0) {
              costPerTicket = Number((tP2P / rewardAmount).toFixed(5)).toString();
            }
            
            // Removed flawed fallback recalculation because it does not recursively calculate material costs

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
          }
        });
      }

      // 3. Weekly Chores
      if (!titleText.includes('Summary') && !titleText.includes('Delivery') && !titleText.includes('Bounties') && !titleText.includes('Farm #')) {
        let categoryName = titleText.replace(/[0-9.]+%|\(.*?\)/g, '').trim();
        let items = [];
        body.find('.badge').each((j, bEl) => {
          const choreText = $c(bEl).find('.ta-left').text().trim();
          if (!choreText) return;

          let completed = 0, total = 0, rewardAmount = 0, rewardType = 'Unknown';
          const rightDiv = $c(bEl).find('.ta-right, .ms-auto').last();

          if (rightDiv.length > 0) {
            const children = rightDiv.children();
            const rewardText = children.last().text().trim();
            const progressText = children.length >= 2 ? children.eq(-2).text().trim() : children.first().text().trim();

            const pMatch = progressText.match(/([0-9,]+)\s*\/\s*([0-9,]+)/);
            if (pMatch) {
              completed = parseInt(pMatch[1].replace(/,/g, ''));
              total = parseInt(pMatch[2].replace(/,/g, ''));
            } else {
              const singleMatch = progressText.match(/([0-9,]+)/);
              if (singleMatch) {
                total = parseInt(singleMatch[1].replace(/,/g, ''));
                completed = total;
              }
            }

            let sflChore = null;
            if (gameData && gameData.choreBoard && gameData.choreBoard.chores) {
              const choresList = Object.values(gameData.choreBoard.chores);

              const choreNum = parseInt(choreText.match(/\d+/)?.[0] || '0');
              const words1 = choreText.toLowerCase().split(/\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');

              sflChore = choresList.find(c => {
                if (c.name.toLowerCase() === choreText.toLowerCase()) return true;
                const cNum = parseInt(c.name.match(/\d+/)?.[0] || '0');
                if (cNum !== choreNum && choreNum > 0) return false;

                const words2 = c.name.toLowerCase().split(/\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');
                return words1.some(w => words2.includes(w)) || (words1.length === 0 && words2.length === 0);
              });
              if (!sflChore) console.log("NO MATCH FOR:", choreText);
            }

            if (sflChore) {
              console.log("MATCHED:", choreText, "->", sflChore.name, "Reward:", sflChore.reward);
              if (sflChore.reward.items && Object.keys(sflChore.reward.items).length > 0) {
                const itemName = Object.keys(sflChore.reward.items)[0];
                rewardAmount = sflChore.reward.items[itemName];
                rewardType = itemName;
              } else if (sflChore.reward.coins > 0) {
                rewardAmount = sflChore.reward.coins;
                rewardType = 'Coins';
              }
            } else {
              const rewardMatch = rewardText.match(/([0-9,]+)/);
              if (rewardMatch) {
                rewardAmount = parseInt(rewardMatch[1].replace(/,/g, ''));
              }
              if (rightDiv.html().includes('tickets/')) rewardType = 'Shiny Feather';
              else if (rightDiv.html().toLowerCase().includes('gem.png') || rightDiv.html().toLowerCase().includes('gem')) rewardType = 'Gem';
              else rewardType = 'Coins';
            }
          }

          // Rule 1: Weekly Chores gets Clothes Buff and VIP Buff
          if (rewardType === 'Shiny Feather') {
            let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
            rewardAmount += ticketClothesBuff;
            if (inventory.hasVip) rewardAmount += 2;
          }

          let status = 'not_ready';
          if ($c(bEl).hasClass('text-bg-success')) status = 'claimed';
          else if ($c(bEl).hasClass('text-bg-warning') || completed >= total) status = 'ready';
          else if ($c(bEl).hasClass('text-bg-danger')) status = 'not_ready';

          items.push({ name: choreText, completed, total, reward: rewardAmount, rewardType, status });
        });

        if (items.length > 0) {
          chores.push({ category: categoryName, items });
        }
      }

      // 4. Bounties
      if (titleText.includes('Bounties')) {
        const usedBountyIds = new Set();
        body.find('.badge').each((i, bEl) => {
          const choreText = $c(bEl).find('.ta-left').text().trim();
          if (!choreText) return;

          let completed = 0, total = 0, reward = 0, rewardType = 'Unknown';
          const rightDiv = $c(bEl).find('.ta-right, .ms-auto').first();
          let reqId = undefined;

          if (rightDiv.length > 0) {
            const children = rightDiv.children();
            const rewardText = children.last().text().trim();
            const progressText = children.length >= 2 ? children.eq(-2).text().trim() : children.first().text().trim();

            const pMatch = progressText.match(/([0-9,]+)\s*\/\s*([0-9,]+)/);
            if (pMatch) {
              completed = parseInt(pMatch[1].replace(/,/g, ''));
              total = parseInt(pMatch[2].replace(/,/g, ''));
            } else if ($c(bEl).find('.bi-check2-circle').length > 0) {
              const singleMatch = progressText.match(/([0-9,]+)/);
              if (singleMatch) {
                total = parseInt(singleMatch[1].replace(/,/g, ''));
                completed = total;
              } else {
                total = 1; completed = 1;
              }
            } else {
              const singleMatch = progressText.match(/([0-9,]+)/);
              if (singleMatch) {
                total = parseInt(singleMatch[1].replace(/,/g, ''));
                completed = total;
              }
            }

            const rewardMatch = rewardText.match(/([0-9,]+)/);
            if (rewardMatch) {
              reward = parseInt(rewardMatch[1].replace(/,/g, ''));
            }

            // Match with API gameData.bounties.requests if available
            if (gameData && gameData.bounties && gameData.bounties.requests) {
               const bReqs = gameData.bounties.requests.filter(r => choreText.toLowerCase().includes(r.name.toLowerCase()));
              if (bReqs.length > 0) {
                let ticketClothesBuffLocal = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                let poppyBuffLocal = (summary.poppyBounty && summary.poppyBounty.status !== 'danger') ? 100 : 0;

                let matchingReq = bReqs.find(r => {
                  if (usedBountyIds.has(r.id)) return false;
                  if (r.coins && r.coins === reward) return true;
                  if (r.items) {
                    const itemAmount = Object.values(r.items)[0];
                    const itemName = Object.keys(r.items)[0];
                    if (itemAmount === reward) return true;
                    if (itemName === 'Shiny Feather' && (itemAmount + ticketClothesBuffLocal) === reward) return true;
                    if (itemName === 'Shiny Feather' && (itemAmount + ticketClothesBuffLocal + poppyBuffLocal) === reward) return true;
                  }
                  return false;
                });

                if (!matchingReq) {
                  matchingReq = bReqs.find(r => !usedBountyIds.has(r.id));
                }

                const selectedReq = matchingReq || bReqs[0];
                if (selectedReq.id) usedBountyIds.add(selectedReq.id);
                reqId = selectedReq.id;

                if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                  const itemName = Object.keys(selectedReq.items)[0];
                  rewardType = itemName;
                  reward = selectedReq.items[itemName];
                } else if (selectedReq.coins > 0) {
                  rewardType = 'Coins';
                  reward = selectedReq.coins;
                } else if (selectedReq.sfl > 0) {
                  rewardType = 'SFL';
                  reward = selectedReq.sfl;
                }
              } else {
                // Fallback
                if (rightDiv && rightDiv.html()) {
                  const htmlStr = rightDiv.html();
                  if (htmlStr.includes('tickets/')) rewardType = 'Shiny Feather';
                  else if (htmlStr.includes('Gem.png') || htmlStr.toLowerCase().includes('gem')) rewardType = 'Gem';
                  else rewardType = 'Coins';
                }
              }
            } else {
              if (rightDiv && rightDiv.html()) {
                const htmlStr = rightDiv.html();
                if (htmlStr.includes('tickets/')) rewardType = 'Shiny Feather';
                else if (htmlStr.includes('Gem.png') || htmlStr.toLowerCase().includes('gem')) rewardType = 'Gem';
                else rewardType = 'Coins';
              }
            }

            // Apply Rule 1: 3 NFT Clothes Buff for Bounties
            if (rewardType === 'Shiny Feather') {
              let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
              reward += ticketClothesBuff;
            }
          }

          let status = 'not_ready';
          if ($c(bEl).hasClass('text-bg-success')) status = 'claimed';
          else if ($c(bEl).hasClass('text-bg-warning') || completed >= total) status = 'ready';
          else if ($c(bEl).hasClass('text-bg-danger')) status = 'not_ready';

          // Retrieve reqId if it was set during matching, otherwise undefined
          let currentReqId = undefined;
          if (typeof reqId !== 'undefined') currentReqId = reqId;
          else if (gameData && gameData.bounties && gameData.bounties.requests) {
             const fallbackReqs = gameData.bounties.requests.filter(r => choreText.toLowerCase().includes(r.name.toLowerCase()));
             const fallbackReq = fallbackReqs.find(r => !usedBountyIds.has(r.id)) || fallbackReqs[0];
             if (fallbackReq && fallbackReq.id) {
               currentReqId = fallbackReq.id;
               usedBountyIds.add(fallbackReq.id);
             }
          }

          bounties.push({ id: currentReqId, name: choreText, completed, total, reward, rewardType, status });
        });

        let poppyStatus = 'not_ready';
        if (gameData && gameData.bounties) {
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
          } else if (gameData.bounties.requests && gameData.bounties.completed && gameData.bounties.requests.length > 0) {
            const completedIds = gameData.bounties.completed.map(c => c.id);
            const allDone = gameData.bounties.requests.every(r => completedIds.includes(r.id));
            if (allDone) poppyStatus = 'ready';
          }
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
    }); // close the main blocks loop

// 5. Animals logic rewritten to use API
    if (gameData && gameData.bounties && gameData.bounties.requests) {
        let completedBounties = (gameData.bounties.completed || []).map(c => c.id);
        const animalReqs = gameData.bounties.requests.filter(r => r.name && (r.name.toLowerCase().includes('cow') || r.name.toLowerCase().includes('sheep') || r.name.toLowerCase().includes('chicken')));
        animalReqs.forEach(req => {
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
                
                const isCompleted = completedBounties.includes(req.id);
                // Extract Level from req.level API property
                const level = req.level ? `Lv ${req.level}` : 'Lv ?';
                
                animals.push({
                    id: req.id,
                    animalName: req.name.split(' ')[0],
                    level: level,
                    reward: rewardAmount,
                    rewardType: rewardType,
                    status: isCompleted ? 'claimed' : 'ready'
                });
            }
        });
    }

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
