require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const doc = await col.findOne({ _id: '6279470157500012' });
    if (!doc || !doc.deliveries) {
      console.log('Document not found');
      return;
    }

    for (const [date, deliveries] of Object.entries(doc.deliveries)) {
      const targets = deliveries.filter(d => ['Betty', 'Blacksmith', 'Tango', 'Peggy'].includes(d.npcName));
      if (targets.length > 0) {
        console.log(`\n=== Date: ${date} ===`);
        targets.forEach(t => {
           console.log(`[${t.npcName}] Count: ${t.count} | Status: ${t.status} | RewardType: ${t.rewardType} | Reward: ${t.reward} | Cost: ${t.totalP2PCost} | Items: ${t.reqItems ? t.reqItems.map(i=>i.total + ' ' + i.name).join(', ') : 'none'}`);
        });
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

check();
