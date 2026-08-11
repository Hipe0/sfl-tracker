const { initDB, getHistoryCollection } = require('./src-backend/config/db.cjs');

async function checkDeliveries() {
  await initDB();
  const collection = getHistoryCollection();
  const doc = await collection.findOne({ _id: "6279470157500012" });
  if (doc && doc.deliveries) {
    const d10 = doc.deliveries["2026-08-10"] || [];
    const d11 = doc.deliveries["2026-08-11"] || [];
    
    const d10_tickets = d10.filter(d => d.rewardType === 'Shiny Feather');
    const d11_tickets = d11.filter(d => d.rewardType === 'Shiny Feather');
    
    console.log(`2026-08-10 Ticket tasks count: ${d10_tickets.length}`);
    console.log(`2026-08-11 Ticket tasks count: ${d11_tickets.length}`);
    
    let sum10 = 0;
    d10_tickets.forEach(t => sum10 += (typeof t.reward === 'string' ? parseInt(t.reward.replace(/[^0-9]/g, '')) || 0 : t.reward));
    console.log(`2026-08-10 Ticket sum: ${sum10}`);
    
    let sum11 = 0;
    d11_tickets.forEach(t => sum11 += (typeof t.reward === 'string' ? parseInt(t.reward.replace(/[^0-9]/g, '')) || 0 : t.reward));
    console.log(`2026-08-11 Ticket sum: ${sum11}`);
    
  }
  process.exit(0);
}

checkDeliveries();
