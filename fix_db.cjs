const { MongoClient } = require('mongodb'); 
require('dotenv').config({path: './.env'}); 

MongoClient.connect(process.env.MONGODB_URI).then(async c => { 
  const db = c.db('test'); 
  const col = db.collection('history'); 
  const doc = await col.findOne({ _id: '6279470157500012' }); 
  if (!doc || !doc.deliveries || !doc.deliveries['2026-09-02']) {
      console.log('No deliveries found for 2026-09-02');
      return c.close(); 
  }
  
  let changed = false; 
  const counts = {}; 
  
  doc.deliveries['2026-09-02'].sort((a,b) => a.timestamp - b.timestamp).forEach(d => { 
    if (d.status === 'success' && d.rewardType === 'Shiny Feather') { 
      counts[d.npcName] = (counts[d.npcName] || 0) + 1; 
      if (counts[d.npcName] === 1 && !String(d.reward).includes('(x2)')) { 
        d.reward *= 2; 
        changed = true; 
      } 
    } 
  }); 
  
  if (changed) {
    await col.updateOne({_id: '6279470157500012'}, {$set: {['deliveries.2026-09-02']: doc.deliveries['2026-09-02']}}); 
    console.log('Fixed DB for today'); 
  } else {
    console.log('No changes needed');
  }
  c.close(); 
}).catch(console.error);
