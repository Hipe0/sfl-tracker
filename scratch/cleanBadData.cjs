const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
initDB().then(async () => {
  const res = await getHistoryCollection().deleteMany({ timestamp: { $in: [1789365600, 1789452000] } });
  console.log('Deleted bad mock entries:', res.deletedCount);
  process.exit(0);
});
