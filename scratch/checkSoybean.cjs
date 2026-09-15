const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');
initDB().then(async () => {
  const docs = await getHistoryCollection().find({}).sort({timestamp: -1}).limit(20).toArray();
  docs.forEach(d => {
    if (d.marketPrices && d.marketPrices.Soybean) {
      console.log(new Date(d.timestamp*1000).toISOString(), d.marketPrices.Soybean.sflPrice, d.marketPrices.Soybean.usdPrice);
    }
  });
  process.exit(0);
})
