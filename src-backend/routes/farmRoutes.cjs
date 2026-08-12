const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const { verifyToken } = require('../middlewares/auth.cjs');
const { getHistoryCollection } = require('../config/db.cjs');
const { recordFarmHistory } = require('../services/historyService.cjs');
const path = require('path');

let ascensionMilestones = [];
try {
  ascensionMilestones = require(path.join(__dirname, '../data/ascensionMilestones.json'));
} catch (e) {
  console.warn("Could not load ascensionMilestones.json");
}

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
      const sflRes = await fetch(`https://api.sunflower-land.com/visit/${farmId}`);
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
      const updateRes = await fetch(`https://sfl.world/update/${farmId}`, { timeout: 5000 });
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
        const communityRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
          headers: { 'x-api-key': apiKey }
        });
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
    let chapterRes, landRes, boostRes, craftingRes, cookingRes, pricesRes;
    try {
      [chapterRes, landRes, boostRes, craftingRes, cookingRes, pricesRes] = await Promise.all([
        fetch(`https://sfl.world/land/${farmId}/chapter`),
        fetch(`https://sfl.world/land/${farmId}`),
        fetch(`https://sfl.world/boost/${farmId}`),
        fetch('https://sfl.world/info/crafting'),
        fetch('https://sfl.world/info/cooking'),
        fetch('https://sfl.world/api/v1/prices')
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

    let p2pPrices = {};
    if (pricesRes.ok) {
      const priceData = await pricesRes.json();
      p2pPrices = priceData?.data?.p2p || {};
    }
    const html = await chapterRes.text();
    const $c = cheerio.load(html);

    const craftingCosts = {};
    if (craftingRes.ok) {
      const craftingHtml = await craftingRes.text();
      const $cr = cheerio.load(craftingHtml);
      $cr('.cursor-pointer').each((i, el) => {
        const name = $cr(el).find('.b').first().text().trim();
        const costText = $cr(el).find('.small b').first().text().trim();
        const cost = parseFloat(costText);
        if (name && !isNaN(cost)) {
          craftingCosts[name] = cost;
        }
      });
    }

    if (cookingRes.ok) {
      const cookingHtml = await cookingRes.text();
      const $co = cheerio.load(cookingHtml);
      $co('tbody tr').each((i, el) => {
        const rawName = $co(el).find('td').eq(1).text().trim();
        const name = rawName.replace(/Time:.*/, '').trim();
        const sflText = $co(el).find('td').eq(3).text().trim();
        const cost = parseFloat(sflText);
        if (name && !isNaN(cost)) {
          craftingCosts[name] = cost;
        }
      });
    }

    const toolCosts = {};
    let hasVipAccess = false;

    // Scrape global config from land and boost pages
    let globalConfig = {
      coinRate: null,
      island: null,
      tax: null
    };

    if (boostRes.ok) {
      const boostHtml = await boostRes.text();
      if (boostHtml.includes('VIP Access')) {
        hasVipAccess = true;
      }
      const $b = cheerio.load(boostHtml);
      $b('div, span, button, a, .badge').each((i, el) => {
        const text = $b(el).text();
        const match = text.match(/Coin rate 1:([0-9,.]+)/);
        if (match) globalConfig.coinRate = match[1];
      });
      $b('.accordion-item').each((i, el) => {
        const title = $b(el).find('.accordion-button').text().trim();
        if (title === 'Fishing') {
          $b(el).find('tbody tr').each((j, tr) => {
            const text = $b(tr).text().replace(/\s+/g, ' ').trim();
            const matchName = text.match(/^([A-Za-z ]+)\s+🎣/);
            if (matchName) {
              const name = matchName[1].trim();
              const rodCostMatch = text.match(/Total tool\s*([\d.]+)\s*FLW/);
              if (rodCostMatch) toolCosts[name] = parseFloat(rodCostMatch[1]);
            }
          });
          // Sometimes the general rod cost is just at the top of Fishing section
          const fishingHtml = $b(el).html();
          if (fishingHtml) {
            const rodMatch = fishingHtml.match(/Rod\.png.*?Flower\.png.*?fw-bold">([\d.]+)</);
            if (rodMatch) toolCosts['Rod'] = parseFloat(rodMatch[1]);
          }
        } else if (title === 'Resources') {
          let currentResource = null;
          $b(el).find('tbody tr').each((j, tr) => {
            const text = $b(tr).text().replace(/\s+/g, ' ').trim();
            const nameMatch = text.match(/^([A-Za-z ]+)⛏/);
            if (nameMatch) {
              currentResource = nameMatch[1].trim().toLowerCase();
            }

            const toolMatch = text.match(/Total tool\s*([\d.]+)\s*FLW/);
            if (currentResource && toolMatch) {
              toolCosts[currentResource] = parseFloat(toolMatch[1]);
              currentResource = null;
            }
          });
        } else if (['Crops', 'Fruits', 'Greenhouse', 'Flowers & Honey'].includes(title)) {
          let currentItem = null;
          $b(el).find('tbody tr').each((j, tr) => {
            const firstColText = $b(tr).find('td').first().text().replace(/\s+/g, ' ').trim();
            const firstColImg = $b(tr).find('td').first().find('img').first().attr('src');

            if (firstColImg && firstColImg.includes('/source/')) {
              currentItem = firstColText.toLowerCase();
            }

            if (currentItem) {
              const html = $b(tr).html();
              const seedMatch = html.match(/Seed FLW<\/span><span class="bval">([\d.]+)/);
              const harvestMatch = html.match(/Harvests<\/span><span class="bval">([\d.–-]+)/);

              if (seedMatch) {
                let harvests = 1;
                if (harvestMatch) {
                  const hStr = harvestMatch[1];
                  if (hStr.includes('–')) {
                    const parts = hStr.split('–');
                    harvests = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
                  } else {
                    harvests = parseFloat(hStr);
                  }
                }
                toolCosts[currentItem] = { cost: parseFloat(seedMatch[1]), harvests };
                currentItem = null;
              }
            }
          });
        }
      });
      console.log('Scraped toolCosts:', toolCosts);
      console.log('Scraped toolCosts:', toolCosts);
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
        if (titleText.includes('Delivery for Coins') || titleText.includes('Delivery for Flower')) {
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

            // Calculate P2P cost
            const fallbackPrices = {
              'Old Snapper': 0.15, 'Shrimp': 0.2, 'Kraken Tentacle': 0.3,
              'Anchovy': 0.05, 'Tuna': 0.2, 'Squid': 0.1, 'Red Snapper': 0.15,
              'Salt Lick': 0.1, 'Yarn': 0.05, 'Yellow Clover': 0.01,
              'Crimstone': 0.65, 'Iron': 0.07, 'Gold': 0.44, 'Wood': 0.01, 'Stone': 0.03
            };
            let totalP2PCost = 0;
            reqItems.forEach(item => {
              let price = p2pPrices[item.name] || craftingCosts[item.name];
              if (!price && toolCosts[item.name.toLowerCase()]) {
                 const tc = toolCosts[item.name.toLowerCase()];
                 price = typeof tc === 'object' ? tc.cost : tc;
              }
              if (!price) price = fallbackPrices[item.name] || 0.005;
              totalP2PCost += (price * item.total);
            });

            // Note: gameData might not be fully fetched/processed here yet, 
            // but we can at least store it in a temporary array and map it later, 
            // or use whatever is available. Wait, gameData is fetched BEFORE landRes?
            // Yes! gameData is fetched from SFL community API before this block.
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
            const ordersList = (gameData && gameData.delivery && gameData.delivery.orders) || (farmHistory && farmHistory.cached_orders) || [];
            const sflOrder = ordersList.find(o => o.from.toLowerCase() === npcName.toLowerCase());
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
                  const inv = (gameData && gameData.inventory) ? gameData.inventory : ((farmHistory && farmHistory.cached_inventory) ? farmHistory.cached_inventory : inventory);
                  if (inv) {
                    let invKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
                    if (invKey) {
                      currAmt = parseFloat(inv[invKey]) || 0;
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
                   
                   totalP2PCost = 0;
                   reqItems.forEach(item => {
                     let price = p2pPrices[item.name] || craftingCosts[item.name];
                     if (!price && toolCosts[item.name.toLowerCase()]) {
                        const tc = toolCosts[item.name.toLowerCase()];
                        price = typeof tc === 'object' ? tc.cost : tc;
                     }
                     if (!price) price = fallbackPrices[item.name] || 0.005;
                     totalP2PCost += (price * item.total);
                   });
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

            let reward = '';
            let costPerTicket = '';
            let totalCost = '';
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
                if (trText.includes('P2P') || trText.includes('per one')) {
                  const td1Text = $c(rTrEl).find('td').eq(1).text().trim();
                  const matchCost = td1Text.match(/^([\d.]+)/);
                  if (matchCost) totalCost = matchCost[1];

                  const p2pSpan = $c(rTrEl).find('span').last();
                  if (p2pSpan.length > 0 && p2pSpan.text().includes('per one')) {
                    costPerTicket = p2pSpan.text().replace(/[()]/g, '').trim();
                  } else {
                    const match = trText.match(/\((.*?per one.*?)\)/);
                    if (match) costPerTicket = match[1];
                  }
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
              if (sflOrder.items && Object.keys(sflOrder.items).length > 0) {
                 const apiReqItems = [];
                 for (const [itemName, total] of Object.entries(sflOrder.items)) {
                    let currAmt = 0;
                    const inv = (gameData && gameData.inventory) ? gameData.inventory : ((farmHistory && farmHistory.cached_inventory) ? farmHistory.cached_inventory : inventory);
                    if (inv) {
                      let invKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
                      if (invKey) {
                        currAmt = parseFloat(inv[invKey]) || 0;
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
                     let isStale = false;
                     if (reqItems.length !== apiReqItems.length) {
                         isStale = true;
                     } else {
                         for (let i = 0; i < apiReqItems.length; i++) {
                             const apiItem = apiReqItems[i];
                             const htmlItem = reqItems.find(r => r.name.toLowerCase() === apiItem.name.toLowerCase());
                             if (!htmlItem || htmlItem.total !== apiItem.total) {
                                 isStale = true;
                                 break;
                             }
                         }
                     }

                     reqItems.length = 0;
                     reqItems.push(...apiReqItems);
                     
                     if (isStale) {
                         totalCost = '';
                     }
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
              
              const currentSeason = 'Ascension Age'; // Hardcoded for current SFL ticket season
              const chapterBoosts = CHAPTER_TICKET_BOOST_ITEMS[currentSeason];
              if (chapterBoosts) {
                Object.values(chapterBoosts).forEach(boostItem => {
                   const inWardrobe = gameData && gameData.wardrobe && gameData.wardrobe[boostItem];
                   const inInventory = gameData && gameData.inventory && gameData.inventory[boostItem];
                   const inTrackerInv = inventory && inventory[boostItem];
                   
                   let isEquipped = checkIsEquipped(gameData, boostItem);
                   
                   if (inWardrobe || inInventory || inTrackerInv || isEquipped) {
                      calculatedTickets += 1;
                   }
                });
              }
              
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

            let tP2P = totalCost ? parseFloat(totalCost) : 0;
            
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
          if (gameData.bounties.bonusClaimedAt > 0) {
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

    // Fetch Market Prices and attach to Bounties
    try {
      if (pricesRes.ok) {
        // We already fetched pricesRes above, p2pPrices is already set.

        // Inject Mariner Pot and Crab Pot prices
        if (globalConfig.coinRate) {
          const rate = parseFloat(globalConfig.coinRate.replace(/,/g, ''));
          if (rate > 0) {
            const featherPrice = p2pPrices['Feather'] || 0;
            const merinoWoolPrice = p2pPrices['Merino Wool'] || 0;
            const woolPrice = p2pPrices['Wool'] || 0;

            if (featherPrice > 0 && merinoWoolPrice > 0) {
              toolCosts['Mariner Pot'] = 10 * featherPrice + 10 * merinoWoolPrice + (500 / rate);
            }
            if (featherPrice > 0 && woolPrice > 0) {
              toolCosts['Crab Pot'] = 5 * featherPrice + 3 * woolPrice + (250 / rate);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching market prices:", err);
    }

    try {
      const fishRes = await fetch('https://sfl.world/info/fishing/info');
      if (fishRes.ok) {
        const fishHtml = await fishRes.text();
        const $f = cheerio.load(fishHtml);
        $f('table tbody tr').each((i, el) => {
          const firstTd = $f(el).find('td').first();
          const name = firstTd.text().trim();
          if (name) {
            const lastTd = $f(el).find('td').last();
            const htmlLast = lastTd.html() || '';
            // Match typical cost with a flower image
            if (htmlLast.includes('Flower.png')) {
              // Extract the first number found (to avoid combining multiple like in Crab Stick)
              const textLast = lastTd.text().trim();
              const match = textLast.match(/[\d.]+/);
              if (match) {
                const price = parseFloat(match[0]);
                if (!isNaN(price) && !craftingCosts[name]) {
                  craftingCosts[name] = price;
                }
              }
            }
          }
        });
      }
    } catch (err) {
      console.error("Error fetching fishing prices:", err);
    }

    const craftingKeys = Object.keys(craftingCosts).sort((a, b) => b.length - a.length);

    // Map chore costs
    chores = chores.map(category => {
      return {
        ...category,
        items: category.items.map(item => {
          let choreCost = 0;
          let foundKey = null;
          let hasCost = false;

          // Check if it's a tool-based task (Crafting Rods or Chopping/Mining)
          if (item.name.match(/Craft\s+\d+\s+Fishing Rods/i)) {
            foundKey = 'Fishing Rod';
            if (toolCosts['Rod'] !== undefined) {
              choreCost = Number((toolCosts['Rod'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Fish\s+\d+\s+times/i)) {
            foundKey = 'Fishing Rod';
            if (toolCosts['Rod'] !== undefined) {
              choreCost = Number((toolCosts['Rod'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Craft\s+\d+\s+Mariner Pots?/i)) {
            foundKey = 'Mariner Pot';
            if (toolCosts['Mariner Pot'] !== undefined) {
              choreCost = Number((toolCosts['Mariner Pot'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Craft\s+\d+\s+Crab Pots?/i)) {
            foundKey = 'Crab Pot';
            if (toolCosts['Crab Pot'] !== undefined) {
              choreCost = Number((toolCosts['Crab Pot'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Chop\s+\d+\s+Trees/i)) {
            foundKey = 'Axe';
            if (toolCosts['wood'] !== undefined) {
              choreCost = Number((toolCosts['wood'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Mine\s+\d+\s+Stones/i)) {
            foundKey = 'Pickaxe';
            if (toolCosts['stone'] !== undefined) {
              choreCost = Number((toolCosts['stone'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Mine\s+\d+\s+Iron/i)) {
            foundKey = 'Stone Pickaxe';
            if (toolCosts['iron'] !== undefined) {
              choreCost = Number((toolCosts['iron'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Mine\s+\d+\s+Gold/i)) {
            foundKey = 'Iron Pickaxe';
            if (toolCosts['gold'] !== undefined) {
              choreCost = Number((toolCosts['gold'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Mine\s+\d+\s+Crimstone/i)) {
            foundKey = 'Gold Pickaxe';
            if (toolCosts['crimstone'] !== undefined) {
              choreCost = Number((toolCosts['crimstone'] * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Dig\s+\d+\s+times/i)) {
            foundKey = 'Shovel';
            let shovelCost = (toolCosts['wood'] || 0) + (toolCosts['stone'] || 0) + (toolCosts['iron'] || 0);
            if (shovelCost > 0) {
              choreCost = Number((shovelCost * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Collect\s+Eggs\s+\d+\s+times/i)) {
            foundKey = 'Wheat';
            if (toolCosts['wheat'] && toolCosts['wheat'].cost !== undefined) {
              choreCost = Number((toolCosts['wheat'].cost * item.total).toFixed(5));
              hasCost = true;
            } else if (toolCosts['wheat'] !== undefined) {
              choreCost = Number(((toolCosts['wheat'] || 0) * item.total).toFixed(5)); // fallback
              hasCost = true;
            }
          } else if (item.name.match(/Dig\s+\d+\s+times/i)) {
            foundKey = 'Shovel';
            let shovelCost = (toolCosts['wood'] || 0) + (toolCosts['stone'] || 0) + (toolCosts['iron'] || 0);
            if (shovelCost > 0) {
              choreCost = Number((shovelCost * item.total).toFixed(5));
              hasCost = true;
            }
          } else if (item.name.match(/Collect\s+Eggs\s+\d+\s+times/i)) {
            foundKey = 'Wheat';
            if (toolCosts['wheat'] && toolCosts['wheat'].cost !== undefined) {
              choreCost = Number((toolCosts['wheat'].cost * item.total).toFixed(5));
              hasCost = true;
            } else if (toolCosts['wheat'] !== undefined) {
              choreCost = Number(((toolCosts['wheat'] || 0) * item.total).toFixed(5)); // fallback
              hasCost = true;
            }
          }

          // Check if it's a crop or fruit task
          let matchCrop = item.name.match(/Harvest\s+([A-Za-z\s]+)\s+\d+\s+times/i);
          let matchPick = item.name.match(/Pick\s+\d+\s+([A-Za-z\s]+)/i);
          let matchGrow = item.name.match(/Grow\s+([A-Za-z\s]+)\s+\d+\s+times/i);

          if (matchCrop || matchPick || matchGrow) {
            let cropNameRaw = matchCrop ? matchCrop[1] : (matchPick ? matchPick[1] : matchGrow[1]);
            cropNameRaw = cropNameRaw.trim().toLowerCase();
            const plurals = {
              'potatoes': 'potato',
              'tomatoes': 'tomato',
              'radishes': 'radish',
              'blueberries': 'blueberry',
              'strawberries': 'strawberry',
              'cranberries': 'cranberry',
              'sunflowers': 'sunflower',
              'duskberries': 'duskberry',
              'cosmos': 'cosmos',
              'lotus': 'lotus',
              'cactus': 'cactus'
            };

            if (plurals[cropNameRaw]) {
              cropNameRaw = plurals[cropNameRaw];
            } else if (cropNameRaw.endsWith('s')) {
              cropNameRaw = cropNameRaw.slice(0, -1);
            }

            if (toolCosts[cropNameRaw] && toolCosts[cropNameRaw].cost !== undefined) {
              foundKey = cropNameRaw.charAt(0).toUpperCase() + cropNameRaw.slice(1);
              const seedData = toolCosts[cropNameRaw];
              choreCost = Number(((seedData.cost / seedData.harvests) * item.total).toFixed(5));
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

          // If not a tool task, fall back to crafting/cooking costs
          foundKey = craftingKeys.find(k => item.name.includes(k));
          if (foundKey) {
            choreCost = Number((craftingCosts[foundKey] * item.total).toFixed(5));
            return {
              ...item,
              itemType: foundKey,
              unitCost: craftingCosts[foundKey],
              choreCost: choreCost,
              totalP2PCost: choreCost,
              totalMarketCost: Number((choreCost / 0.9).toFixed(5)),
              avgCost: item.reward > 0 ? Number((choreCost / item.reward).toFixed(5)) : null
            };
          }
          return item;
        })
      };
    });

    bounties = bounties.map(b => {
      let isFromScrape = false;
      let val = p2pPrices[b.name];

      if (val === undefined && craftingCosts[b.name] !== undefined) {
        val = craftingCosts[b.name];
        isFromScrape = true;
      }

      if (val !== undefined) {
        let mPrice, pPrice;
        if (isFromScrape) {
          pPrice = val;
          mPrice = Number((val / 0.9).toFixed(5));
        } else {
          mPrice = val;
          pPrice = Number((val * 0.9).toFixed(5));
        }
        let totalPPrice = Number((pPrice * b.total).toFixed(5));
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

      res.json({
        success: true,
        data: {
          ...publicData,
          summary,
          scrapedDeliveries: deliveries,
          coinDeliveries: coinDeliveries,
          chores,
          bounties,
          animals,
          inventory,
          globalConfig,
          gameData,
          ascensionMilestoneTickets,
          prices: { 
            ...p2pPrices, 
            'Crab Pot': toolCosts['Crab Pot'] || 0, 
            'Mariner Pot': toolCosts['Mariner Pot'] || 0 
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
