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
    if (!doc || !doc.deliveries || !doc.deliveries['2026-08-12']) return;

    let dels = doc.deliveries['2026-08-12'];
    
    // Group by npc
    const groups = {};
    dels.forEach(d => {
       if (!groups[d.npcName]) groups[d.npcName] = [];
       groups[d.npcName].push(d);
    });
    
    const toRemove = new Set();

    for (const [npc, tasks] of Object.entries(groups)) {
       // sort by count
       tasks.sort((a, b) => a.count - b.count);
       
       for (let i = 0; i < tasks.length - 1; i++) {
           let curr = tasks[i];
           let next = tasks[i+1];
           
           if (!curr.count || !next.count) continue;
           
           const currItems = curr.reqItems ? JSON.stringify(curr.reqItems.map(i => `${i.total}_${i.name}`).sort()) : '';
           const nextItems = next.reqItems ? JSON.stringify(next.reqItems.map(i => `${i.total}_${i.name}`).sort()) : '';
           
           const timeDiff = Math.abs(curr.timestamp - next.timestamp);
           
           if (currItems === nextItems && timeDiff < 60000) {
               console.log(`Duplicate detected for ${npc}: count ${curr.count} (timeDiff: ${timeDiff})`);
               // Mark the earlier one for removal
               toRemove.add(`${npc}_${curr.count}`);
           }
       }
    }

    let newDeliveries = dels.filter(d => !toRemove.has(`${d.npcName}_${d.count}`));

    await col.updateOne({ _id: '8052347903218326' }, { $set: { [`deliveries.2026-08-12`]: newDeliveries } });
    console.log(`Database fixed successfully! Removed ${toRemove.size} duplicated items.`);
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

fix();
