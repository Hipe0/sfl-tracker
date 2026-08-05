const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('sfl_tracker');
  const col = db.collection('history');
  
  const docs = await col.find({}).toArray();
  for (const doc of docs) {
    let changed = false;
    
    // 1. First, fix the wrong Kale Omelette entry for farm 6279470157500012
    if (doc._id === '6279470157500012') {
       for (const [dateStr, dayTasks] of Object.entries(doc.deliveries || {})) {
          for (let task of dayTasks) {
             if (task.npcName.toLowerCase() === 'grubnuk' && task.reqItems && task.reqItems[0] && task.reqItems[0].name === 'Kale Omelette') {
                 console.log('Fixing Kale Omelette to Red Wiggler for Grubnuk!');
                 task.reqItems[0].name = 'Red Wiggler';
                 task.reqItems[0].total = 3;
                 task.reqItems[0].img = 'https://sfl.world/img/delivery/Red Wiggler.png';
                 task.reward = 0.55; 
                 task.totalP2PCost = 0; 
                 changed = true;
             }
          }
       }
    }
    
    // 2. Assign counts to all tasks
    const npcStats = doc.npc_stats || {};
    
    const tasksByNpc = {};
    if (doc.deliveries) {
       for (const [dateStr, dayTasks] of Object.entries(doc.deliveries)) {
          for (let i = 0; i < dayTasks.length; i++) {
             const task = dayTasks[i];
             const npcKey = task.npcName.toLowerCase();
             if (!tasksByNpc[npcKey]) tasksByNpc[npcKey] = { successes: [], skips: [] };
             
             if (task.status === 'skipped') {
                 tasksByNpc[npcKey].skips.push(task);
             } else {
                 tasksByNpc[npcKey].successes.push(task);
             }
          }
       }
    }
    
    for (const [npcKey, groups] of Object.entries(tasksByNpc)) {
       const stats = npcStats[npcKey] || npcStats[npcKey.charAt(0).toUpperCase() + npcKey.slice(1)] || { deliveryCount: 0, skippedCount: 0 };
       
       groups.successes.sort((a, b) => a.timestamp - b.timestamp);
       groups.skips.sort((a, b) => a.timestamp - b.timestamp);
       
       const totalSuccesses = groups.successes.length;
       const apiDeliveryCount = stats.deliveryCount || 0;
       let startSuccessCount = apiDeliveryCount - totalSuccesses + 1;
       if (startSuccessCount < 1) startSuccessCount = 1;
       
       groups.successes.forEach(t => {
           t.count = startSuccessCount++;
           if (t.status !== 'success') t.status = 'success';
           changed = true;
       });
       
       const totalSkips = groups.skips.length;
       const apiSkipCount = stats.skippedCount || 0;
       let startSkipCount = apiSkipCount - totalSkips + 1;
       if (startSkipCount < 1) startSkipCount = 1;
       
       groups.skips.forEach(t => {
           t.count = startSkipCount++;
           changed = true;
       });
    }
    
    if (changed) {
       await col.updateOne({ _id: doc._id }, { $set: { deliveries: doc.deliveries } });
       console.log(`Updated farm ${doc._id}`);
    }
  }
  
  await client.close();
}
run().catch(console.error);
