require('dotenv').config();
const { MongoClient } = require('mongodb');

async function test() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const historyCollection = client.db('sfl_tracker').collection('history');
  
  const farmId = '6279470157500012';
  const dateStr = new Date().toISOString().split('T')[0];
  let farmHistory = await historyCollection.findOne({ _id: farmId });
  
  const comRes = await fetch('https://api.sunflower-land.com/community/farms/'+farmId, {headers: {'x-api-key': process.env.SFL_API_KEY}});
  const d = await comRes.json();
  const gameData = d.farm;
  
  let vipClaimedToday = false;
  if (gameData && gameData.pumpkinPlaza && gameData.pumpkinPlaza.pirateChest && gameData.pumpkinPlaza.pirateChest.openedAt) {
    const openedDateStr = new Date(gameData.pumpkinPlaza.pirateChest.openedAt).toISOString().split('T')[0];
    console.log('Opened:', openedDateStr, 'Today:', dateStr);
    if (openedDateStr === dateStr) vipClaimedToday = true;
  }
  
  console.log('vipClaimedToday:', vipClaimedToday);
  if (vipClaimedToday) {
    if (!farmHistory.daily_chest[dateStr]) {
      farmHistory.daily_chest[dateStr] = {
        reward: 1,
        timestamp: Date.now()
      };
      await historyCollection.updateOne({_id: farmId}, {$set: farmHistory});
      console.log('Updated DB');
    } else {
      console.log('Not updating DB. Already exists?', !!farmHistory.daily_chest[dateStr]);
    }
  }
  
  console.log(farmHistory.daily_chest);
  await client.close();
}

test().catch(console.error);
