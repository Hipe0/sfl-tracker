async function run() {
    const res = await fetch('https://sfl.world/api/v1/prices');
    const data = await res.json();
    const p2pPrices = data?.data?.p2p || {};
    console.log("Stone price:", p2pPrices['Stone']);
    console.log("Wood price:", p2pPrices['Wood']);
    
    // Also let's test a sample fix logic:
    const tasks = [
      {
        npcName: 'Blacksmith',
        reward: 1268,
        rewardType: 'Coins',
        reqItems: [
          { name: 'Stone', total: 10, completed: 153.65, enough: true, img: null },
          { name: 'Wood', total: 20, completed: 438.1, enough: true, img: null }
        ],
        totalP2PCost: 0
      }
    ];
    
    for (const task of tasks) {
        let cost = 0;
        for (const item of task.reqItems) {
            let price = p2pPrices[item.name];
            if (!price) {
                // Try case-insensitive matching if direct fails
                const key = Object.keys(p2pPrices).find(k => k.toLowerCase() === item.name.toLowerCase());
                if (key) price = p2pPrices[key];
            }
            if (price) {
                cost += price * item.total;
            }
        }
        // Discount 10% buff? We don't know if the user had a buff when they delivered!
        console.log(`Calculated cost for ${task.npcName}: ${cost}`);
    }
}
run();
