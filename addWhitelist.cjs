const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('sfl_tracker');
  
  await db.collection('users').updateOne(
    { farmId: '6279470157500012' }, 
    { $set: { farmId: '6279470157500012' } }, 
    { upsert: true }
  );
  
  console.log("Added 6279470157500012 to whitelist.");
  await client.close();
}
run();
