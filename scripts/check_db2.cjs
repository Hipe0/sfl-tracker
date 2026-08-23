require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    // Find doc that has Betty count 437
    const docs = await col.find({}).toArray();
    for (const doc of docs) {
      if (doc.deliveries) {
        for (const [date, deliveries] of Object.entries(doc.deliveries)) {
          const betty = deliveries.find(d => d.npcName === 'Betty' && d.count === 437);
          if (betty) {
            console.log(`Found ID: ${doc._id} on date ${date}`);
            
            // Log today's tasks
            const targets = deliveries.filter(d => ['Betty', 'Blacksmith', 'Tango', 'Peggy'].includes(d.npcName));
            console.log(`\n=== Date: ${date} ===`);
            targets.forEach(t => {
               console.log(`[${t.npcName}] Count: ${t.count} | Status: ${t.status} | RewardType: ${t.rewardType} | Reward: ${t.reward} | Cost: ${t.totalP2PCost} | Items: ${t.reqItems ? t.reqItems.map(i=>i.total + ' ' + i.name).join(', ') : 'none'}`);
            });
            break;
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

check();
