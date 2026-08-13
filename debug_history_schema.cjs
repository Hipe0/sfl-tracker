require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function run() {
    await initDB();
    const historyCol = getHistoryCollection();
    
    const history = await historyCol.findOne({});
    if (!history) {
        console.log("No history found at all");
        process.exit(1);
    }
    
    console.log("History keys:", Object.keys(history));
    console.log("Deliveries for today:", history.deliveries ? JSON.stringify(history.deliveries['2026-08-13'], null, 2) : "None");
    
    process.exit(0);
}

run().catch(console.error);
