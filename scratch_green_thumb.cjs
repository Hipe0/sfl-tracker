const db = require('./src-backend/config/db.cjs');
db.initDB().then(async () => {
  const h = db.getHistoryCollection();
  const docs = await h.find({}).toArray();
  for (let d of docs) {
    if (!d.gameData) continue;
    const str = JSON.stringify(d.gameData);
    if (str.match(/Green/i) || str.match(/Swindler/i)) {
      console.log('Farm:', d._id);
      const keys = str.match(/"([^"]*(Green|Swindler)[^"]*)"/gi);
      if (keys) console.log(Array.from(new Set(keys)));
    }
  }
  process.exit();
});
