require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fix() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const historyCollection = client.db('sfl_tracker').collection('history');
  
  const farmId = '6279470157500012';
  const farmHistory = await historyCollection.findOne({ _id: farmId });
  
  if (!farmHistory) {
    console.log('No history found for this farm!');
    await client.close();
    return;
  }

  const todayUTC = new Date().toISOString().split('T')[0];
  // hôm nay tính theo VN (UTC+7): nếu giờ UTC < 17h thì ngày VN = ngày UTC, nhưng daily_chest lưu theo UTC
  console.log('--- daily_chest data ---');
  console.log(JSON.stringify(farmHistory.daily_chest, null, 2));
  console.log('--- pirate_chest_opened ---');
  console.log(farmHistory.pirate_chest_opened);

  // Check today's VIP entry
  if (farmHistory.daily_chest && farmHistory.daily_chest[todayUTC]) {
    const current = farmHistory.daily_chest[todayUTC].reward;
    console.log(`\nToday (${todayUTC}): reward = ${current}`);
    
    if (current === 2) {
      console.log('Detected overcounted value (2). Correcting to 1...');
      await historyCollection.updateOne(
        { _id: farmId },
        { $set: { [`daily_chest.${todayUTC}.reward`]: 1 } }
      );
      console.log('Fixed! daily_chest reward set to 1.');
    } else {
      console.log(`Value is ${current} — looks correct, no fix needed.`);
    }
  } else {
    console.log(`No daily_chest entry for today (${todayUTC})`);
    // Also check yesterday (VN time may differ)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (farmHistory.daily_chest && farmHistory.daily_chest[yesterday]) {
      console.log(`Yesterday (${yesterday}): reward = ${farmHistory.daily_chest[yesterday].reward}`);
    }
  }

  await client.close();
}

fix().catch(console.error);
