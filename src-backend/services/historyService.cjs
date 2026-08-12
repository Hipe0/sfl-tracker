const { getHistoryCollection } = require('../config/db.cjs');

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
  if (!getHistoryCollection()) return;
  const dateStr = new Date().toISOString().split('T')[0];
  const weekStr = getISOYearWeek(new Date());
  
  try {
    let farmHistory = await getHistoryCollection().findOne({ _id: farmId });
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
  
    // 0. Check for Daily Reward Collected (VIP Gift Chests)
    const EVENT_START_DATE = new Date('2026-08-03T00:00:00Z');
    if (gameData && gameData.farmActivity) {
      const currentDailyRewardCount = gameData.farmActivity["Daily Reward Collected"] || 0;
      const isVip = gameData?.vip?.expiresAt > Date.now();
        
      let diff = 0;

      if (farmHistory.baseline_daily_reward !== undefined) {
          // Subsequent scans
          if (isVip && currentDailyRewardCount > farmHistory.baseline_daily_reward) {
              diff = currentDailyRewardCount - farmHistory.baseline_daily_reward;
          }
      } else {
          // First scan ever for this metric
          if (isVip) {
              // Calculate retroactive tickets
              let vipStartTime = Date.now();
              if (gameData.vip && gameData.vip.bundles && gameData.vip.bundles.length > 0) {
                  let sortedBundles = [...gameData.vip.bundles].sort((a,b) => b.boughtAt - a.boughtAt);
                  // Find earliest boughtAt
                  let earliest = sortedBundles[sortedBundles.length - 1].boughtAt;
                  vipStartTime = earliest;
              }
              
              const ticketEarnStart = Math.max(EVENT_START_DATE.getTime(), vipStartTime);
              const startDate = new Date(ticketEarnStart);
              startDate.setUTCHours(0, 0, 0, 0);
              
              const endDate = new Date();
              endDate.setUTCHours(0, 0, 0, 0);
              
              const diffDays = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0) {
                  diff = diffDays + 1; // including start day
              }
          }
      }

      // Ensure diff is not insanely huge (cap it at the number of days since Aug 3)
      const maxPossibleDays = Math.floor((Date.now() - EVENT_START_DATE.getTime()) / 86400000) + 2;
      if (diff > maxPossibleDays) diff = maxPossibleDays;

      if (diff > 0) {
          if (!farmHistory.vip_gift) farmHistory.vip_gift = {};
          
          if (farmHistory.baseline_daily_reward === undefined) {
               // First run of new logic. Overwrite any garbage from Pirate Chests
               farmHistory.vip_gift[weekStr] = diff;
          } else {
               farmHistory.vip_gift[weekStr] = (farmHistory.vip_gift[weekStr] || 0) + diff;
          }
          changed = true;
      }
      
      // Update baseline
      farmHistory.baseline_daily_reward = currentDailyRewardCount;
      changed = true;
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

        if (skipDiff > 0) {
           for (let i = 0; i < skipDiff; i++) {
              let skippedRewardType = 'Unknown';
              if (prevActiveDataList.length > 0) {
                 let taskData = prevActiveDataList[0].data.data || prevActiveDataList[0].data;
                 if (taskData && taskData.rewardType) skippedRewardType = taskData.rewardType;
              }
              currentDayHistory.push({
                 npcName: npcId.charAt(0).toUpperCase() + npcId.slice(1),
                 reward: 0,
                 rewardType: skippedRewardType,
                 status: 'skipped',
                 timestamp: Date.now()
              });
              changed = true;
           }
        }
        
        if (diff > 0) {
          const npcScrapedData = deliveries.filter(d => d.npcName.toLowerCase() === npcId.toLowerCase());
          const claimedTask = npcScrapedData.find(d => d.status === 'claimed' || d.status === 'success');
          
          const recordNpcName = (prevActiveDataList.length > 0) ? prevActiveDataList[0].key.split('_')[0] : (npcScrapedData.length > 0 ? npcScrapedData[0].npcName : npcId);
          
          const orderData = (gameData.delivery && gameData.delivery.orders) 
            ? gameData.delivery.orders.find(o => o.from.toLowerCase() === npcId.toLowerCase()) 
            : null;
          const isCurrentCompleted = orderData && orderData.completedAt;

          const addPrevTask = (tasksToCreate) => {
            if (prevActiveDataList.length > 0 && skipDiff === 0) {
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
              
              let taskData = prevActiveData.data || prevActiveData;
              let finalReward = parseFloat(taskData.reward || 0);
              if (isNaN(finalReward)) finalReward = taskData.rewardAmount || 0;
              
              for (let i = 0; i < tasksToCreate; i++) {
                let thisReward = finalReward;
                let isFirst = !currentDayHistory.some(t => t.npcName.toLowerCase() === npcId.toLowerCase() && t.status === 'success');
                if (isX2Day && isFirst && !String(taskData.reward).includes('(x2)')) {
                  thisReward *= 2;
                }
                currentDayHistory.push({
                  npcName: taskData.npcName || (recordNpcName.charAt(0).toUpperCase() + recordNpcName.slice(1)),
                  reward: thisReward,
                  rewardType: taskData.rewardType || 'Unknown',
                  reqItems: taskData.reqItems || [],
                  totalP2PCost: taskData.totalP2PCost,
                  status: 'success',
                  count: prevDeliveryCount + i + 1,
                  timestamp: Date.now() - (1000 * diff) + (1000 * i)
                });
                changed = true;
              }
            } else {
              let taskToUse = claimedTask;
              if (!taskToUse && npcScrapedData.length > 0) {
                 taskToUse = npcScrapedData.find(d => d.isCoinType) || npcScrapedData.find(d => d.status === 'ready') || npcScrapedData[0];
              }

              if (taskToUse) {
                let finalReward = parseFloat(taskToUse.reward || 0);
                if (isNaN(finalReward)) finalReward = taskToUse.rewardAmount || 0;
                
                for (let i = 0; i < tasksToCreate; i++) {
                  let thisReward = finalReward;
                  let isFirst = !currentDayHistory.some(t => t.npcName.toLowerCase() === npcId.toLowerCase() && t.status === 'success');
                  if (isX2Day && isFirst && !String(taskToUse.reward).includes('(x2)')) {
                    thisReward *= 2;
                  }
                  currentDayHistory.push({
                    npcName: taskToUse.npcName || recordNpcName,
                    reward: thisReward,
                    rewardType: taskToUse.rewardType || 'Unknown',
                    reqItems: taskToUse.reqItems || [],
                    totalP2PCost: taskToUse.totalP2PCost,
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
            }
          };

          const addCurrentTask = () => {
            let taskToUse = claimedTask;
            if (!taskToUse && npcScrapedData.length > 0) {
               taskToUse = npcScrapedData.find(d => d.isCoinType) || npcScrapedData.find(d => d.status === 'ready') || npcScrapedData[0];
            }
            if (taskToUse) {
              let finalReward = parseFloat(taskToUse.reward || 0);
              if (isNaN(finalReward)) finalReward = taskToUse.rewardAmount || 0;
              let isFirst = !currentDayHistory.some(t => t.npcName.toLowerCase() === npcId.toLowerCase() && t.status === 'success');
              if (isX2Day && isFirst && !String(taskToUse.reward).includes('(x2)')) {
                 finalReward *= 2;
              }

              currentDayHistory.push({
                npcName: taskToUse.npcName || recordNpcName,
                reward: finalReward,
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

    // Retro-patch missing costs: If live page scraped the actual cost for a claimed task,
    // update the history entry if it was saved with 0 (due to stale HTML).
    deliveries.forEach(d => {
       if ((d.status === 'claimed' || d.status === 'success') && d.totalP2PCost) {
           // Find the most recent matching success entry in today's history
           const histEntries = currentDayHistory.filter(h => 
               h.npcName.toLowerCase() === d.npcName.toLowerCase() && 
               h.status === 'success'
           );
           if (histEntries.length > 0) {
               const latestHist = histEntries[histEntries.length - 1];
               if (!latestHist.totalP2PCost || latestHist.totalP2PCost === 0) {
                   latestHist.totalP2PCost = d.totalP2PCost;
                   changed = true;
               }
           }
       }
    });
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

  // 4. Animals
  if (animals && animals.length > 0) {
    animals.forEach(a => {
      if (a.status === 'claimed') {
        const animalKey = a.id || `${a.animalName}-${a.level}`;
        if (!farmHistory.animals_completed[animalKey]) {
          farmHistory.animals_completed[animalKey] = {
            week: weekStr,
            reward: a.reward,
            rewardType: a.rewardType
          };
          changed = true;
        }
      }
    });
  }

    // 5. Cleanup unused legacy fields
    delete farmHistory.baseline_pirate_chest;
    delete farmHistory.gift_chest;
    delete farmHistory.pirate_chest_opened;

    if (changed) {
      await getHistoryCollection().updateOne({ _id: farmId }, { $set: farmHistory }, { upsert: true });
    }
  } catch (err) {
    console.error(`[History] Failed to record history for ${farmId}:`, err);
  }
};



module.exports = { recordFarmHistory };
