require('dotenv').config();
const { MongoClient } = require('mongodb');

async function check() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const col = db.collection('history');
    
    const doc = await col.findOne({ _id: '8052347903218326' });
    if (!doc || !doc.deliveries || !doc.deliveries['2026-08-12']) return;

    const dels = doc.deliveries['2026-08-12'];
    
    // Group by npc
    const groups = {};
    dels.forEach(d => {
       if (!groups[d.npcName]) groups[d.npcName] = [];
       groups[d.npcName].push(d);
    });
    
    for (const [npc, tasks] of Object.entries(groups)) {
       console.log(`\nNPC: ${npc}`);
       tasks.forEach(t => {
          console.log(`  Count: ${t.count} | Status: ${t.status} | Timestamp: ${t.timestamp} | Reward: ${t.reward}`);
       });
    }

  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

check();
