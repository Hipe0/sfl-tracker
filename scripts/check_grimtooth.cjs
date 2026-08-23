require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function run() {
    await initDB();
    const historyCol = getHistoryCollection();
    const doc = await historyCol.findOne({ _id: '6279470157500012' });
    if (doc && doc.cached_orders) {
        const grimtooth = doc.cached_orders.find(o => o.from === 'Grimtooth' || o.from === 'grimtooth');
        console.log("Grimtooth from cached_orders in DB:", JSON.stringify(grimtooth, null, 2));
    } else {
        console.log("No cached orders found in DB");
    }
    process.exit(0);
}
run();
