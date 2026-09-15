const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
initDB().then(async () => {
  const res = await getHistoryCollection().deleteMany({ $or: [{ 'marketPrices.Soybean.sflPrice': { $lt: 0.0015 } }, { 'marketPrices.Soybean.sflPrice': { $gt: 0.002 } }] });
  console.log('Deleted bad mock entries:', res.deletedCount);
  process.exit(0);
});
