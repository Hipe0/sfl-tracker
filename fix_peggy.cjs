require('dotenv').config();
const { MongoClient } = require('mongodb');

async function fix() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('No MONGODB_URI found');
  
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('test');
    // let's try test or sfl_tracker
    let col = db.collection('history');
    
    // Check if doc exists in test
    let doc = await col.findOne({ _id: '6279470157500012' });
    if (!doc) {
       const db2 = client.db('sfl_tracker');
       col = db2.collection('history');
       doc = await col.findOne({ _id: '6279470157500012' });
    }
    
    if (!doc || !doc.deliveries) {
      console.log('Document or deliveries not found.');
      return;
    }

    let modified = false;
    for (const [date, deliveries] of Object.entries(doc.deliveries)) {
      for (const d of deliveries) {
        if (d.npcName === 'Peggy' && d.status === 'skipped' && d.rewardType !== 'Coins') {
          console.log(`Fixing Peggy skip on ${date} from ${d.rewardType} to Coins`);
          d.rewardType = 'Coins';
          modified = true;
        }
        if (d.npcName === 'Peggy' && d.status === 'success' && d.rewardType !== 'Coins') {
           console.log(`Fixing Peggy success on ${date} from ${d.rewardType} to Coins`);
           d.rewardType = 'Coins';
           modified = true;
        }
      }
    }

    if (modified) {
      await col.updateOne({ _id: '6279470157500012' }, { $set: { deliveries: doc.deliveries } });
      console.log('Successfully updated database.');
    } else {
      console.log('No modifications needed.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

fix();
