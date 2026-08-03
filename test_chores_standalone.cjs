require('dotenv').config();

const choreText = "Mine 28 Crimstone";

async function run() {
  const res = await fetch('https://api.sunflower-land.com/community/farms/6279470157500012', {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  const gameData = data.farm;

  let sflChore = null;
  if (gameData && gameData.choreBoard && gameData.choreBoard.chores) {
    const choresList = Object.values(gameData.choreBoard.chores);
    console.log("Found", choresList.length, "chores in API");

    const choreNum = parseInt(choreText.match(/\d+/)?.[0] || '0');
    const words1 = choreText.toLowerCase().split(/\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');

    sflChore = choresList.find(c => {
       if (c.name.toLowerCase() === choreText.toLowerCase()) return true;
       const cNum = parseInt(c.name.match(/\d+/)?.[0] || '0');
       if (cNum !== choreNum && choreNum > 0) return false;
       
       const words2 = c.name.toLowerCase().split(/\s+/).filter(w => isNaN(w) && w.length > 3 && w !== 'times');
       return words1.some(w => words2.includes(w)) || (words1.length === 0 && words2.length === 0);
    });
    
    if (sflChore) {
      console.log("MATCHED:", choreText, "->", sflChore.name, "Reward:", JSON.stringify(sflChore.reward));
      
      let rewardAmount = 0, rewardType = 'Unknown';
      if (sflChore.reward.items && Object.keys(sflChore.reward.items).length > 0) {
        const itemName = Object.keys(sflChore.reward.items)[0];
        rewardAmount = sflChore.reward.items[itemName];
        rewardType = itemName;
      } else if (sflChore.reward.coins > 0) {
        rewardAmount = sflChore.reward.coins;
        rewardType = 'Coins';
      }
      console.log("Parsed:", rewardAmount, rewardType);
    } else {
      console.log("NO MATCH FOR:", choreText);
    }
  }
}
run();
