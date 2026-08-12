const { MongoClient } = require('mongodb');
require('dotenv').config();
const fs = require('fs');

async function checkDb() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    
    const history = await db.collection('history').findOne({ _id: '92441' });
    if (history) {
       fs.writeFileSync('src-backend/history_92441_dump.json', JSON.stringify(history, null, 2));
       console.log('Saved history to src-backend/history_92441_dump.json');
    } else {
      console.log("History not found in DB.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}
checkDb();
