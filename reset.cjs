const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('sfl_tracker');
  const history = await db.collection('history').findOne({_id: '3223908578433905'});
  console.log('vip_gift:', history?.vip_gift);
  
  // reset it so the retro formula recalculates!
  await db.collection('history').updateOne(
    {_id: '3223908578433905'}, 
    {$unset: {baseline_daily_reward: 1, vip_gift: 1}}
  );
  
  console.log("Reset done");
  await client.close();
}
run();
