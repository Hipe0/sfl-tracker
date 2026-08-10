const fs = require('fs');
if (!fs.existsSync('api_response.json')) { console.log('No api_response.json'); process.exit(); }
const d = require('./api_response.json').data;
if (!d || !d.gameData) { console.log('No gameData'); process.exit(); }
const bounties = d.gameData.bounties;
console.log('Completed Bounty IDs:', bounties.completed.map(c => c.id));
const animalNames = ['chicken', 'cow', 'sheep'];
const animalRequests = bounties.requests.filter(r => animalNames.some(a => (r.name||'').toLowerCase().includes(a)));
console.log('\nAnimal Requests:');
animalRequests.forEach(r => {
  const isCompleted = bounties.completed.some(c => c.id === r.id);
  const rewardType = r.items ? Object.keys(r.items)[0] : 'Coins';
  console.log(`- ${r.id}: ${r.name} (Reward: ${rewardType}) -> Completed: ${isCompleted}`);
});
