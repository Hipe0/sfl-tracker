const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const farmId = '6279470157500012';
  const apiKey = process.env.SFL_API_KEY;
  
  if (!apiKey) {
      console.log('No API key');
      return;
  }
  
  const communityRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': apiKey }
  });
  
  if (communityRes.ok) {
    const resData = await communityRes.json();
    const gameData = resData.farm;
    
    if (gameData && gameData.inventory) {
        const client = new MongoClient(process.env.MONGODB_URI);
        await client.connect();
        const db = client.db('sfl_tracker');
        const col = db.collection('history');
        
        await col.updateOne({ _id: farmId }, { $set: { cached_inventory: gameData.inventory } });
        console.log('Updated cached_inventory in MongoDB!');
        await client.close();
    }
  } else {
      console.log('Failed to fetch from SFL API, rate limited?');
  }
}
run().catch(console.error);
