const d = require('./api_response.json').data;
const bounties = d.gameData.bounties;
const animalRequests = bounties.requests.filter(r => (r.name||'').toLowerCase().includes('chicken'));
animalRequests.forEach(r => {
  const rewardType = r.items ? Object.keys(r.items)[0] : 'Coins';
  if (rewardType === 'Shiny Feather') {
     console.log(`- ${r.id}: Lvl ${r.level||1} (Base Reward: ${r.items[rewardType]})`);
  }
});
