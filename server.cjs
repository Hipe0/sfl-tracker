const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("CRITICAL: MONGODB_URI is not set in .env");
  process.exit(1);
}
const client = new MongoClient(MONGODB_URI);
let historyCollection;

async function initDB() {
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    historyCollection = db.collection('history');
    console.log("Connected to MongoDB successfully!");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
}
initDB();

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

const recordFarmHistory = async (farmId, deliveries, chores, bounties, animals, summary, inventory, gameData) => {
  if (!historyCollection) return;
  const dateStr = new Date().toISOString().split('T')[0];
  const weekStr = getISOYearWeek(new Date());
  
  try {
    let farmHistory = await historyCollection.findOne({ _id: farmId });
    let changed = false;

    if (!farmHistory) {
      farmHistory = { 
        _id: farmId,
        deliveries: {}, 
        chores: {}, 
        bounties_completed: {}, 
        animals_completed: {},
        daily_chest: {},
        active_deliveries: {},
        delivery_stats: { fulfilledCount: 0 }
      };
      changed = true;
    }
  
    if (!farmHistory.delivery_stats) {
      farmHistory.delivery_stats = { fulfilledCount: 0 };
      changed = true;
    }
    
    if (!farmHistory.active_deliveries) farmHistory.active_deliveries = {};
    if (!farmHistory.daily_chest) farmHistory.daily_chest = {};
  
  // 0. Daily VIP Chest (Pirate Chest)
  // Strategy: use farmActivity["Pirate Chest Opened"] as a cumulative counter.
  // We track the last known count in pirate_chest_opened.
  // IMPORTANT: On first run (undefined), we only save the baseline — do NOT record a chest
  // because we have no reference point to know if the user opened one today.
  const currentPirateChestCount = (gameData && gameData.farmActivity && gameData.farmActivity["Pirate Chest Opened"]) || 0;

  if (farmHistory.pirate_chest_opened === undefined) {
    // First time seeing this farm — just save baseline, don't credit any chest
    farmHistory.pirate_chest_opened = currentPirateChestCount;
    changed = true;
    console.log(`[DEBUG VIP] First run — saved baseline pirate_chest_opened = ${currentPirateChestCount}`);
  } else if (currentPirateChestCount > farmHistory.pirate_chest_opened) {
    // A new chest was opened since last scan
    const pirateChestReward = currentPirateChestCount - farmHistory.pirate_chest_opened;
    
    if (!farmHistory.daily_chest[dateStr]) {
      farmHistory.daily_chest[dateStr] = {
        reward: pirateChestReward,
        timestamp: Date.now()
      };
    } else {
      // Already recorded today — only add if the reward increased (guard against re-scans)
      farmHistory.daily_chest[dateStr].reward += pirateChestReward;
      farmHistory.daily_chest[dateStr].timestamp = Date.now();
    }
    
    farmHistory.pirate_chest_opened = currentPirateChestCount;
    changed = true;
    console.log(`[DEBUG VIP] Detected ${pirateChestReward} new Pirate Chest(s) opened (total: ${currentPirateChestCount})`);
  } else {
    console.log(`[DEBUG VIP] No new chests detected (current: ${currentPirateChestCount}, saved: ${farmHistory.pirate_chest_opened})`);
  }
  if (!farmHistory.cached_orders) farmHistory.cached_orders = [];

  // Store orders to cache for fallback
  if (gameData && gameData.delivery && gameData.delivery.orders) {
    farmHistory.cached_orders = gameData.delivery.orders;
    changed = true;
  }

  if (gameData && gameData.inventory) {
    farmHistory.cached_inventory = gameData.inventory;
    changed = true;
  }
  
  if (inventory) {
    farmHistory.tracker_inventory = inventory;
    changed = true;
  }
  
  // 1. Deliveries
  if (deliveries && deliveries.length > 0) {
    if (!farmHistory.deliveries[dateStr]) farmHistory.deliveries[dateStr] = [];
    const currentDayHistory = farmHistory.deliveries[dateStr];
    
    // Check active_deliveries to see if any previously active delivery was replaced
    const currentActiveMap = {};
    deliveries.forEach(d => {
      const reqStr = d.reqItems ? d.reqItems.map(i => `${i.name}-${i.total}`).join('|') : '';
      const taskKey = `${d.reward}_${reqStr}`;
      const uniqueNpcKey = `${d.npcName.toLowerCase()}_${d.isCoinType ? 'coin' : 'ticket'}`;
      if (d.status !== 'claimed' && d.status !== 'success') {
        currentActiveMap[uniqueNpcKey] = taskKey;
      }
    });

    // Initialize npc_stats if not present
    if (!farmHistory.npc_stats) farmHistory.npc_stats = {};

    // Check if today is an x2 day
    let isX2Day = false;
    if (gameData && gameData.calendar && gameData.calendar.dates) {
      const eventToday = gameData.calendar.dates.find(d => d.date === dateStr && d.name === 'doubleDelivery');
      if (eventToday) isX2Day = true;
    }

    // Process explicitly claimed tasks from sfl.world that might not be caught by diff 
    // if the user doesn't use the tracker correctly, just as a fallback.
    // Wait, the NPC logic will catch all of them. But we can still loop over claimed tasks to be safe?
    // Let's rely entirely on the NPC logic!

    if (gameData && gameData.npcs) {
      for (const [npcId, npcData] of Object.entries(gameData.npcs)) {
        const currentDeliveryCount = npcData.deliveryCount || 0;
        const currentSkippedCount = npcData.skippedCount || 0;
        
        // Upgrade legacy number to object, or default to current count on first run
        if (typeof farmHistory.npc_stats[npcId] === 'number') {
          farmHistory.npc_stats[npcId] = { deliveryCount: farmHistory.npc_stats[npcId], skippedCount: 0 };
          changed = true;
        } else if (farmHistory.npc_stats[npcId] === undefined) {
          farmHistory.npc_stats[npcId] = { deliveryCount: currentDeliveryCount, skippedCount: currentSkippedCount };
          changed = true;
        }

        const prevStats = farmHistory.npc_stats[npcId];
        const prevDeliveryCount = prevStats.deliveryCount || 0;
        let diff = currentDeliveryCount - prevDeliveryCount;
        let skipDiff = currentSkippedCount - (prevStats.skippedCount || 0);

        // Also update the skipped count if it changed
        if (prevStats.skippedCount !== currentSkippedCount || prevStats.deliveryCount !== currentDeliveryCount) {
          farmHistory.npc_stats[npcId] = { deliveryCount: currentDeliveryCount, skippedCount: currentSkippedCount };
          changed = true;
        }
        
        if (skipDiff > 0) {
           for (let i = 0; i < skipDiff; i++) {
              currentDayHistory.push({
                 npcName: npcId.charAt(0).toUpperCase() + npcId.slice(1),
                 reward: 0,
                 status: 'skipped',
                 timestamp: Date.now()
              });
              changed = true;
           }
        }
        
        if (diff > 0) {
          const npcScrapedData = deliveries.filter(d => d.npcName.toLowerCase() === npcId.toLowerCase());
          const claimedTask = npcScrapedData.find(d => d.status === 'claimed' || d.status === 'success');
          
          let prevActiveDataList = [];
          for (const key in farmHistory.active_deliveries) {
            // Find any active tasks that match this NPC (could be legacy name, _ticket, or _coin)
            if (key.toLowerCase() === npcId.toLowerCase() || 
                key.toLowerCase() === `${npcId.toLowerCase()}_ticket` || 
                key.toLowerCase() === `${npcId.toLowerCase()}_coin`) {
              prevActiveDataList.push({
                 key: key,
                 data: farmHistory.active_deliveries[key]
              });
            }
          }
          
          const recordNpcName = (prevActiveDataList.length > 0) ? prevActiveDataList[0].key.split('_')[0] : (npcScrapedData.length > 0 ? npcScrapedData[0].npcName : npcId);
          
          const orderData = (gameData.delivery && gameData.delivery.orders) 
            ? gameData.delivery.orders.find(o => o.from.toLowerCase() === npcId.toLowerCase()) 
            : null;
          const isCurrentCompleted = orderData && orderData.completedAt;

          const addPrevTask = (tasksToCreate) => {
            let taskToUse = claimedTask;
            if (!taskToUse && npcScrapedData.length > 0) {
               taskToUse = npcScrapedData.find(d => d.isCoinType) || npcScrapedData.find(d => d.status === 'ready') || npcScrapedData[0];
            }

            if (taskToUse) {
              let finalReward = parseFloat(taskToUse.reward || 0);
              if (isNaN(finalReward)) finalReward = taskToUse.rewardAmount || 0;
              if (isX2Day) finalReward *= 2;
              
              for (let i = 0; i < tasksToCreate; i++) {
                currentDayHistory.push({
                  npcName: taskToUse.npcName || recordNpcName,
                  reward: finalReward,
                  rewardType: taskToUse.rewardType || 'Unknown',
                  reqItems: taskToUse.reqItems || [],
                  totalP2PCost: taskToUse.totalP2PCost,
                  status: 'success',
                  count: prevDeliveryCount + i + 1,
                  timestamp: Date.now() - (1000 * diff) + (1000 * i)
                });
                changed = true;
              }
            } else if (prevActiveDataList.length > 0 && skipDiff === 0) {
              let prevActiveData = prevActiveDataList[0].data;
              if (prevActiveDataList.length > 1) {
                const missing = prevActiveDataList.find(prev => {
                   const isCoin = prev.key.endsWith('_coin');
                   const stillExists = deliveries.some(d => 
                      d.npcName.toLowerCase() === npcId.toLowerCase() && 
                      (d.isCoinType || false) === isCoin
                   );
                   return !stillExists;
                });
                if (missing) prevActiveData = missing.data;
              }
              let finalReward = parseFloat(prevActiveData.data.reward || 0);
              if (isNaN(finalReward)) finalReward = prevActiveData.data.rewardAmount || 0;
              if (isX2Day && prevActiveData.date !== dateStr) {
                finalReward *= 2;
              }
              
              for (let i = 0; i < tasksToCreate; i++) {
                currentDayHistory.push({
                  npcName: recordNpcName.charAt(0).toUpperCase() + recordNpcName.slice(1),
                  reward: finalReward,
                  rewardType: prevActiveData.data.rewardType || 'Unknown',
                  reqItems: prevActiveData.data.reqItems || [],
                  totalP2PCost: prevActiveData.data.totalP2PCost,
                  status: 'success',
                  count: prevDeliveryCount + i + 1,
                  timestamp: Date.now() - (1000 * diff) + (1000 * i)
                });
                changed = true;
              }
            } else {
              // Fallback
              for (let i = 0; i < tasksToCreate; i++) {
                currentDayHistory.push({
                  npcName: recordNpcName.charAt(0).toUpperCase() + recordNpcName.slice(1),
                  reward: 0,
                  rewardType: 'Unknown',
                  reqItems: [],
                  status: 'success',
                  count: prevDeliveryCount + i + 1,
                  timestamp: Date.now() - (1000 * diff) + (1000 * i)
                });
                changed = true;
              }
            }
          };

          const addCurrentTask = () => {
            let taskToUse = claimedTask;
            if (!taskToUse && npcScrapedData.length > 0) {
               taskToUse = npcScrapedData.find(d => d.isCoinType) || npcScrapedData.find(d => d.status === 'ready') || npcScrapedData[0];
            }
            if (taskToUse) {
              currentDayHistory.push({
                npcName: taskToUse.npcName || recordNpcName,
                reward: parseFloat(taskToUse.reward || 0) || taskToUse.rewardAmount || 0,
                rewardType: taskToUse.rewardType || 'Unknown',
                reqItems: taskToUse.reqItems || [],
                totalP2PCost: taskToUse.totalP2PCost,
                status: 'success',
                count: currentDeliveryCount,
                timestamp: Date.now()
              });
              changed = true;
            } else {
              // Fallback
              currentDayHistory.push({
                npcName: recordNpcName.charAt(0).toUpperCase() + recordNpcName.slice(1),
                reward: 0,
                rewardType: 'Unknown',
                reqItems: [],
                status: 'success',
                count: currentDeliveryCount,
                timestamp: Date.now()
              });
              changed = true;
            }
          };

          if (diff >= 2) {
            if (isCurrentCompleted) {
               addPrevTask(diff - 1);
               addCurrentTask();
            } else {
               addPrevTask(diff);
            }
          } else if (diff === 1) {
            if (isCurrentCompleted) {
              addCurrentTask();
            } else {
              addPrevTask(1);
            }
          }
          
          farmHistory.npc_stats[npcId] = { deliveryCount: currentDeliveryCount, skippedCount: currentSkippedCount };
          changed = true;
        }
      }
    }

    // Update active deliveries for tracking tomorrow
    farmHistory.active_deliveries = {};
    for (const [uniqueNpcKey, taskKey] of Object.entries(currentActiveMap)) {
      const scraped = deliveries.find(d => {
         const expectedType = uniqueNpcKey.endsWith('_coin') ? true : false;
         const isCoinType = d.isCoinType || false;
         return d.npcName.toLowerCase() === uniqueNpcKey.split('_')[0] && isCoinType === expectedType;
      });
      if (scraped) {
        farmHistory.active_deliveries[uniqueNpcKey] = {
          taskKey,
          data: scraped,
          date: dateStr
        };
        changed = true;
      }
    }
  }

  // 2. Chores
  if (chores && chores.length > 0) {
    let currentWeekCompleted = 0;
    let currentWeekCost = 0;
    
    chores.forEach(cat => {
      cat.items.forEach(c => {
        if (c.status === 'claimed') {
          if (c.rewardType === 'Shiny Feather') { // Only count ticket tasks
            currentWeekCompleted += (c.reward || 0);
            if (c.totalP2PCost > 0) currentWeekCost += parseFloat(c.totalP2PCost);
          }
        }
      });
    });
    
    if (currentWeekCompleted > 0) {
      if (!farmHistory.chores[weekStr]) {
        farmHistory.chores[weekStr] = { completed: currentWeekCompleted, cost: currentWeekCost };
        changed = true;
      } else {
        // Only update if the values are higher (in case user completes more chores during the week)
        const existing = farmHistory.chores[weekStr];
        if (currentWeekCompleted > existing.completed || currentWeekCost > existing.cost) {
          existing.completed = Math.max(existing.completed, currentWeekCompleted);
          existing.cost = Math.max(existing.cost, currentWeekCost);
          changed = true;
        }
      }
    }
  }

  // 3. Bounties
  if (bounties && bounties.length > 0) {
    bounties.forEach(b => {
      if (b.status === 'claimed') {
        const bountyKey = `${weekStr}-${b.name}`;
        if (!farmHistory.bounties_completed[bountyKey]) {
          farmHistory.bounties_completed[bountyKey] = {
            week: weekStr,
            reward: b.reward,
            rewardType: b.rewardType,
            cost: b.totalP2PCost || 0,
            originalName: b.name
          };
          changed = true;
        }
      }
    });
  }

  // 3.5 Bounties Bonus (Poppy)
  if (summary && summary.poppyBounty && summary.poppyBounty.status === 'success') {
    const bonusKey = `${weekStr}-PoppyBonus`;
    if (!farmHistory.bounties_completed[bonusKey]) {
      farmHistory.bounties_completed[bonusKey] = {
        week: weekStr,
        reward: 50, // Fixed bonus of 50 tickets
        rewardType: 'Shiny Feather',
        cost: 0,
        originalName: 'Poppy Bounty Bonus'
      };
      changed = true;
      console.log(`[Bounties] Recorded 50 tickets bonus for ${weekStr}!`);
    }
  }

  // 4. Animals
  if (animals && animals.length > 0) {
    animals.forEach(a => {
      if (a.status === 'claimed') {
        const animalKey = `${a.animalName}-${a.level}`;
        if (!farmHistory.animals_completed[animalKey]) {
          farmHistory.animals_completed[animalKey] = {
            week: weekStr,
            reward: a.reward
          };
          changed = true;
        }
      }
    });
  }

  if (changed) {
      await historyCollection.updateOne({ _id: farmId }, { $set: farmHistory }, { upsert: true });
    }
  } catch (err) {
    console.error(`[History] Failed to record history for ${farmId}:`, err);
  }
};

const app = express();
app.use(cors());

app.get('/api/farm/:id/history', async (req, res) => {
  const farmId = req.params.id;
  try {
    const history = await historyCollection.findOne({ _id: farmId });
    res.json({ success: true, data: history || { deliveries: {}, chores: {}, bounties_completed: {}, animals_completed: {}, daily_chest: {} } });
  } catch (err) {
    console.error("Failed to fetch history:", err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get('/api/farm/:id', async (req, res) => {
  const farmId = req.params.id;
  
  // Whitelist check
  try {
    const whitelistPath = path.join(__dirname, 'whitelist.json');
    if (fs.existsSync(whitelistPath)) {
      const whitelistData = fs.readFileSync(whitelistPath, 'utf8');
      const whitelist = JSON.parse(whitelistData);
      if (whitelist && Array.isArray(whitelist) && whitelist.length > 0) {
        if (!whitelist.includes(farmId)) {
          console.warn(`[Access Denied] Farm ID ${farmId} is not in the whitelist.`);
          return res.status(403).json({ error: "NOT_WHITELISTED" });
        }
      }
    }
  } catch (err) {
    console.error("Could not read whitelist.json, skipping check:", err.message);
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
      farmHistory = await historyCollection.findOne({ _id: farmId });
    } catch(e) {
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
        if (communityRes.ok) {
          const resData = await communityRes.json();
          if (resData && resData.farm) {
             gameData = resData.farm;
          }
        }
      } catch (e) {
        console.error("SFL Community API error", e);
      }
    }

    const [chapterRes, landRes, boostRes, craftingRes, cookingRes, pricesRes] = await Promise.all([
      fetch(`https://sfl.world/land/${farmId}/chapter`),
      fetch(`https://sfl.world/land/${farmId}`),
      fetch(`https://sfl.world/boost/${farmId}`),
      fetch('https://sfl.world/info/crafting'),
      fetch('https://sfl.world/info/cooking'),
      fetch('https://sfl.world/api/v1/prices')
    ]);
    
    let p2pPrices = {};
    if (pricesRes.ok) {
       const priceData = await pricesRes.json();
       p2pPrices = priceData?.data?.p2p || {};
    }
    
    if (!chapterRes.ok) {
      return res.status(500).json({ error: "Failed to fetch sfl.world chapter" });
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
        if(match) globalConfig.coinRate = match[1];
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
        if(td1 === 'Island') globalConfig.island = td2;
        if(td1 === 'Resource Tax') globalConfig.tax = td2;
      });
      
      const h4Name = $l('td.ta-left.h4 a b').first().text().trim();
      if (h4Name) {
        globalConfig.playerName = h4Name;
      }
      
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
            let totalP2PCost = 0;
            reqItems.forEach(item => {
               const price = p2pPrices[item.name] || craftingCosts[item.name] || 0;
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
                     const age = Date.now() - sflOrder.createdAt;
                     if (age >= 24 * 60 * 60 * 1000) {
                        canSkip = true;
                     } else {
                        skipWaitTime = 24 * 60 * 60 * 1000 - age;
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
            itemsTd.find('.badge').each((k, bEl) => {
              const itemName = $c(bEl).find('div').first().text().trim();
              const smallEl = $c(bEl).find('small');
              const bEl2 = $c(bEl).find('b');
              
              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              }
              if (itemName && total > 0) {
                reqItems.push({ name: itemName, completed, total, enough });
              } else {
                const fallback = $c(bEl).text().trim().replace(/\s+/g, ' ');
                reqItems.push({ name: fallback, completed: 0, total: 0, enough: true });
              }
            });
            
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

            if (sflOrder) {
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
               if (isTicketReward) {
                 rewardType = 'Shiny Feather';
                 exactRewardStr = `${rewardAmount} Shiny Feather`;
               } else {
                 rewardType = 'Coins';
                 exactRewardStr = `${rewardAmount} Coins`;
               }
            }
            
            const status = claimed ? 'claimed' : (reqItems.length === 0 ? 'inactive' : (allEnough ? 'ready' : 'not_ready'));
            
            let tP2P = totalCost ? parseFloat(totalCost) : null;
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
              status 
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
        body.find('.badge').each((j, bEl) => {
          const choreText = $c(bEl).find('.ta-left').text().trim();
          if (!choreText) return;
          
          let completed = 0, total = 0, reward = 0, rewardType = 'Unknown';
          const rightDiv = $c(bEl).find('.ta-right, .ms-auto').first();
          
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
            
            const rewardMatch = rewardText.match(/([0-9,]+)/);
            if (rewardMatch) {
              reward = parseInt(rewardMatch[1].replace(/,/g, ''));
            }
            
            // Match with API gameData.bounties.requests if available
            if (gameData && gameData.bounties && gameData.bounties.requests) {
               const bReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase() === choreText.toLowerCase());
               if (bReqs.length > 0) {
                 // Try to match by reward amount (coins or gems)
                 const matchingReq = bReqs.find(r => {
                    if (r.coins && r.coins === reward) return true;
                    if (r.items) {
                       const itemAmount = Object.values(r.items)[0];
                       if (itemAmount === reward) return true;
                    }
                    return false;
                 });
                 
                 const selectedReq = matchingReq || bReqs[0];
                 if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    rewardType = Object.keys(selectedReq.items)[0];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
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
          }
          
          let status = 'not_ready';
          if ($c(bEl).hasClass('text-bg-success')) status = 'claimed';
          else if ($c(bEl).hasClass('text-bg-warning') || completed >= total) status = 'ready';
          else if ($c(bEl).hasClass('text-bg-danger')) status = 'not_ready';
          
          bounties.push({ name: choreText, completed, total, reward, rewardType, status });
        });
      }
      
      // 5. Animals
      if (titleText.includes('Animals')) {
        body.find('.w75').each((j, taskEl) => {
          const level = $c(taskEl).find('.w100p').text().trim();
          const imgSrc = $c(taskEl).find('img').first().attr('src');
          let animalName = '';
          if (imgSrc) {
            const match = imgSrc.match(/animals\/(.+)\.png/);
            if (match) animalName = match[1];
          }
          
          const rewardText = $c(taskEl).find('.m-top-5').text().trim();
          const reward = parseInt(rewardText.replace(/[^0-9]/g, '')) || 0;
          
          let status = 'not_ready';
          if ($c(taskEl).hasClass('text-bg-success')) status = 'claimed';
          else if ($c(taskEl).hasClass('text-bg-warning')) status = 'not_ready';
          else if ($c(taskEl).hasClass('text-bg-danger')) status = 'ready'; // Danger usually means ready/need action? Or maybe we map 'danger' to missing level? Let's just use 'ready' if danger, 'claimed' if success, 'not_ready' if warning. Wait!
          // Actually, text-bg-warning = blue in their old style? No, warning is yellow. success is green (bdone), danger is red. 
          // Let's stick to status:
          if ($c(taskEl).hasClass('text-bg-success')) status = 'claimed';
          if ($c(taskEl).hasClass('text-bg-danger')) status = 'ready';
          
          if (animalName) {
            animals.push({ animalName, level, reward, status });
          }
        });
      }
    });

    if (hasVipAccess) inventory.hasVip = true;
    if (gameData) {
      if (gameData.wardrobe) {
        if (gameData.wardrobe['Swamp Lily Hat']) inventory.hasHat = true;
        if (gameData.wardrobe['Swamp Armor']) inventory.hasArmor = true;
        if (gameData.wardrobe['Swamp Pants']) inventory.hasPants = true;
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
    const mappedCoinDeliveries = (coinDeliveries || []).map(d => ({
        ...d,
        reward: d.rewardAmount,
        rewardType: d.type === 'coins' ? 'Coins' : 'SFL',
        isCoinType: true
    }));
    const allDeliveries = (deliveries || []).concat(mappedCoinDeliveries);

    // Record history silently (in background)
    recordFarmHistory(farmId, allDeliveries, chores, bounties, animals, summary, inventory, gameData).catch(console.error);

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
        gameData
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for Vercel Cron
app.get('/api/cron', async (req, res) => {
  try {
    const farms = await historyCollection.find({}, { projection: { _id: 1 } }).toArray();
    console.log(`[Cron] Triggering sync for ${farms.length} farms...`);
    for (const doc of farms) {
       const farmId = doc._id;
       const url = `http://${req.headers.host || 'localhost:' + PORT}/api/farm/${farmId}`;
       try {
         await fetch(url);
         console.log(`[Cron] Successfully synced farm ${farmId}`);
       } catch (e) {
         console.error(`[Cron] Failed to sync farm ${farmId}:`, e.message);
       }
    }
    res.json({ success: true, message: "Sync triggered via API" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  
  // Set up node-cron for local environment running at 00:02 UTC (7:02 AM VN)
  cron.schedule('2 0 * * *', async () => {
    console.log('[Local Cron] Running daily sync task at 00:02 UTC');
    try {
      const farms = await historyCollection.find({}, { projection: { _id: 1 } }).toArray();
      for (const doc of farms) {
         const farmId = doc._id;
         const url = `http://localhost:${PORT}/api/farm/${farmId}`;
         try {
           await fetch(url);
           console.log(`[Local Cron] Successfully synced farm ${farmId}`);
         } catch (e) {
           console.error(`[Local Cron] Failed to sync farm ${farmId}:`, e.message);
         }
      }
    } catch (e) {
      console.error('[Local Cron] Error fetching farms from DB:', e);
    }
  });

  // Set up node-cron for local environment running at 23:45 UTC (6:45 AM VN)
  cron.schedule('45 23 * * *', async () => {
    console.log('[Local Cron] Running pre-reset sync task at 23:45 UTC');
    try {
      const farms = await historyCollection.find({}, { projection: { _id: 1 } }).toArray();
      for (const doc of farms) {
         const farmId = doc._id;
         const url = `http://localhost:${PORT}/api/farm/${farmId}`;
         try {
           await fetch(url);
           console.log(`[Local Cron] Successfully synced farm ${farmId} (pre-reset)`);
         } catch (e) {
           console.error(`[Local Cron] Failed to sync farm ${farmId} (pre-reset):`, e.message);
         }
      }
    } catch (e) {
      console.error('[Local Cron] Error fetching farms from DB (pre-reset):', e);
    }
  });
});
