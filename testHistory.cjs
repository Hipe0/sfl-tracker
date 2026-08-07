const { processHistory } = require('./src-backend/services/historyService.cjs');

let mockGameData = {
    vip: { expiresAt: Date.now() + 100000 },
    farmActivity: { "Daily Reward Collected": 10 }
};

let mockFarmHistory = {
    _id: "test",
    deliveries: {}, chores: {}, bounties_completed: {}, animals_completed: {}
};

console.log("RUN 1");
mockFarmHistory = processHistory("test", mockGameData, [], [], [], [], "2026-08-07", {}, mockFarmHistory);
console.log("vip_gift:", mockFarmHistory.vip_gift);
console.log("baseline:", mockFarmHistory.baseline_daily_reward);

console.log("\nRUN 2");
mockGameData.farmActivity["Daily Reward Collected"] = 10;
mockFarmHistory = processHistory("test", mockGameData, [], [], [], [], "2026-08-07", {}, mockFarmHistory);
console.log("vip_gift:", mockFarmHistory.vip_gift);
console.log("baseline:", mockFarmHistory.baseline_daily_reward);

console.log("\nRUN 3");
mockFarmHistory = processHistory("test", mockGameData, [], [], [], [], "2026-08-07", {}, mockFarmHistory);
console.log("vip_gift:", mockFarmHistory.vip_gift);
console.log("baseline:", mockFarmHistory.baseline_daily_reward);
