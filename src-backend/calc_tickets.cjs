const fs = require('fs');

try {
  const history = JSON.parse(fs.readFileSync('src-backend/history_92441_dump.json', 'utf8'));
  let totalDeliveries = 0;
  let totalBounties = 0;
  let totalAnimals = 0;
  let totalChores = 0;
  let totalChests = 0;
  let totalMilestones = 0;

  if (history.deliveries) {
    Object.values(history.deliveries).forEach(dayArr => {
      dayArr.forEach(d => {
        if (d.rewardType === 'Shiny Feather' && d.status === 'success') {
          totalDeliveries += parseFloat(d.reward || 0);
        }
      });
    });
  }
  
  if (history.bounties_completed) {
    Object.values(history.bounties_completed).forEach(d => {
      if (d.rewardType === 'Shiny Feather') {
        totalBounties += parseFloat(d.reward || 0);
      }
    });
  }

  if (history.animals_completed) {
    Object.values(history.animals_completed).forEach(d => {
      if (d.rewardType === 'Shiny Feather') {
        totalAnimals += parseFloat(d.reward || 0);
      }
    });
  }

  if (history.chores_completed) {
    Object.values(history.chores_completed).forEach(d => {
      if (d.rewardType === 'Shiny Feather') {
        totalChores += parseFloat(d.reward || 0);
      }
    });
  }
  
  if (history.dailyChest_completed) {
    Object.values(history.dailyChest_completed).forEach(d => {
      if (d.rewardType === 'Shiny Feather') {
        totalChests += parseFloat(d.reward || 0);
      }
    });
  }

  if (history.milestones_completed) {
    Object.values(history.milestones_completed).forEach(d => {
      if (d.rewardType === 'Shiny Feather') {
        totalMilestones += parseFloat(d.reward || 0);
      }
    });
  }

  console.log(`Deliveries: ${totalDeliveries}`);
  console.log(`Bounties: ${totalBounties}`);
  console.log(`Animals: ${totalAnimals}`);
  console.log(`Chores: ${totalChores}`);
  console.log(`Chests: ${totalChests}`);
  console.log(`Milestones: ${totalMilestones}`);
  const total = totalDeliveries + totalBounties + totalAnimals + totalChores + totalChests + totalMilestones;
  console.log(`Total Tracked Tickets (Shiny Feathers): ${total}`);
  
  const findActivity = (filename) => {
    try {
       const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
       const act = data.farmActivity && data.farmActivity['Shiny Feather Collected'];
       if (act !== undefined) console.log(`farmActivity in ${filename}: ${act}`);
       
       if (data.inventory && data.inventory['Shiny Feather']) {
         console.log(`Inventory in ${filename}: ${data.inventory['Shiny Feather']}`);
       }
    } catch(e) {}
  };
  
  findActivity('api_response.json');
  findActivity('farm1.json');
  findActivity('debug-farm.json');

} catch (err) {
  console.error(err);
}
