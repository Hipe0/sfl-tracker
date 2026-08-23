require('dotenv').config({ path: './.env' });
const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function countFarms() {
    await initDB();
    const historyCol = getHistoryCollection();
    const count = await historyCol.countDocuments();
    const farms = await historyCol.find({}).toArray();
    console.log(`Total farms in history: ${count}`);
    const ids = farms.map(f => f._id);
    console.log(`Farm IDs: ${ids.join(', ')}`);
    process.exit(0);
}
countFarms();
