require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function run() {
    await initDB();
    const historyCol = getHistoryCollection();
    const today = new Date().toISOString().split('T')[0]; // "2026-08-13"
    
    // Fetch prices
    let p2pPrices = {};
    try {
        const res = await fetch('https://sfl.world/api/v1/prices');
        const data = await res.json();
        p2pPrices = data?.data?.p2p || {};
    } catch (err) {
        console.error("Failed to fetch prices.");
        process.exit(1);
    }
    
    const query = {};
    query[`deliveries.${today}`] = { $exists: true };
    const docs = await historyCol.find(query).toArray();
    
    let updatedFarmsCount = 0;
    let fixedTasksCount = 0;
    
    for (const doc of docs) {
        let needsUpdate = false;
        const todayTasks = doc.deliveries[today] || [];
        
        for (const task of todayTasks) {
            if (task.status === 'success' && task.rewardType !== 'Ticket' && task.rewardType !== 'Unknown') {
                if (task.cost === 0 || task.totalP2PCost === 0) {
                    // Calculate cost
                    let calculatedCost = 0;
                    if (task.reqItems && Array.isArray(task.reqItems)) {
                        for (const item of task.reqItems) {
                            let price = p2pPrices[item.name];
                            if (!price) {
                                const key = Object.keys(p2pPrices).find(k => k.toLowerCase() === item.name.toLowerCase());
                                if (key) price = p2pPrices[key];
                            }
                            if (price) {
                                calculatedCost += price * item.total;
                            }
                        }
                    }
                    
                    if (calculatedCost > 0) {
                        task.totalP2PCost = Math.round(calculatedCost * 100) / 100; // Round to 2 decimals
                        if (task.cost !== undefined) {
                            task.cost = task.totalP2PCost;
                        }
                        needsUpdate = true;
                        fixedTasksCount++;
                    }
                }
            }
        }
        
        if (needsUpdate) {
            const updateKey = `deliveries.${today}`;
            await historyCol.updateOne(
                { _id: doc._id },
                { $set: { [updateKey]: todayTasks } }
            );
            updatedFarmsCount++;
        }
    }
    
    console.log(`Successfully fixed ${fixedTasksCount} tasks across ${updatedFarmsCount} farms.`);
    process.exit(0);
}
run();
