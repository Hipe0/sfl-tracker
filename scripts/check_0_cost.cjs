require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function run() {
    await initDB();
    const historyCol = getHistoryCollection();
    const today = new Date().toISOString().split('T')[0]; // "2026-08-13"
    
    const query = {};
    query[`deliveries.${today}`] = { $exists: true };
    
    const docs = await historyCol.find(query).toArray();
    
    console.log(`Found ${docs.length} farms that played today (${today}).`);
    
    let allTasks = [];
    for (const doc of docs) {
        if (doc.deliveries && doc.deliveries[today]) {
            allTasks.push(...doc.deliveries[today]);
        }
    }
    
    console.log(`Total tasks recorded today: ${allTasks.length}`);
    console.log("Sample of 5 tasks:");
    console.dir(allTasks.slice(0, 5), { depth: null });
    
    // Check how many have cost 0
    let zeroCostTasks = allTasks.filter(t => t.cost === 0 || t.totalP2PCost === 0);
    console.log(`Tasks with cost = 0: ${zeroCostTasks.length}`);
    if (zeroCostTasks.length > 0) {
        console.log("Sample zero cost tasks:");
        console.dir(zeroCostTasks.slice(0, 3), { depth: null });
    }
    
    process.exit(0);
}
run();
