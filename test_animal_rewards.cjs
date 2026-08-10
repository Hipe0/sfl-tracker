const fs = require('fs');
const d = require('./api_response.json').data;
const bounties = d.gameData.bounties;
const animalNames = ['cow', 'sheep'];
const animalRequests = bounties.requests.filter(r => animalNames.some(a => (r.name||'').toLowerCase().includes(a)));
animalRequests.forEach(r => {
  const rewardType = r.items ? Object.keys(r.items)[0] : 'Coins';
  if (rewardType === 'Shiny Feather') {
     console.log(`- ${r.id}: ${r.name} Lvl ${r.level||1} (Reward: ${r.items[rewardType]})`);
  }
});
