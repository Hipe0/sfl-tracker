async function test() {
  try {
    const res = await fetch('http://localhost:3001/api/farm/6279470157500012');
    const json = await res.json();
    if (json.success && json.data.scrapedDeliveries) {
      console.log("Deliveries:");
      json.data.scrapedDeliveries.forEach(d => {
        console.log(`${d.npcName} - Reward: ${d.reward} (${d.rewardType}) - Progress: ${d.completed}/${d.total} - Status: ${d.status}`);
      });
    } else {
      console.log("Failed to fetch or missing deliveries", json);
    }
  } catch (e) {
    console.error(e);
  }
}
test();
