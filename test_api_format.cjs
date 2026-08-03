const { spawn } = require('child_process');
const server = spawn('node', ['server.cjs']);

server.stdout.on('data', async (data) => {
  const str = data.toString();
  console.log("SERVER OUT:", str);
  if (str.includes('running on http://localhost:3001')) {
    try {
      const res = await fetch('http://localhost:3001/api/farm/6279470157500012');
      const json = await res.json();
      if (json.success) {
        console.log("Deliveries:");
        json.data.scrapedDeliveries.forEach(d => console.log(`${d.npcName} - ${d.reward} (${d.rewardType}) - ${d.avgCost}`));
        
        console.log("\nChores:");
        json.data.chores.forEach(c => {
           c.items.forEach(i => console.log(`${i.name} - ${i.reward} (${i.rewardType}) - ${i.avgCost}`));
        });
      }
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => server.kill(), 2000);
  }
});
