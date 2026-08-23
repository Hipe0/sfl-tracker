require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fix() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const doc = await col.findOne({ _id: '8052347903218326' });
    if (!doc || !doc.deliveries) {
      console.log('Document not found');
      return;
    }

    const date = '2026-08-12';
    if (!doc.deliveries[date]) return;

    // Filter out the specific duplicates
    const countsToRemove = {
       'Betty': [433, 434, 435, 436],
       'Blacksmith': [490, 491, 492],
       'Tango': [388, 389, 390],
       'Peggy': [160, 161]
    };

    let newDeliveries = doc.deliveries[date].filter(d => {
       if (countsToRemove[d.npcName] && countsToRemove[d.npcName].includes(d.count)) {
          console.log(`Removing duplicated task: ${d.npcName} count ${d.count}`);
          return false;
       }
       return true;
    });

    await col.updateOne({ _id: '8052347903218326' }, { $set: { [`deliveries.${date}`]: newDeliveries } });
    console.log('Database fixed successfully!');
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

fix();
