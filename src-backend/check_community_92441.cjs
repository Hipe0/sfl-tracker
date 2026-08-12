const fs = require('fs');

async function checkCommunityApi() {
  const farmId = '92441';
  try {
    console.log(`Fetching community data for farm ${farmId}...`);
    const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`);
    if (!res.ok) {
      console.error(`Community API Error: ${res.status}`);
      return;
    }
    const data = await res.json();
    
    // The data structure might be { inventory, farmActivity, ... } depending on the community endpoint
    // or maybe { farm: { inventory: ... } }
    let gameData = data.farm || data.state || data;
    
    if (gameData) {
      const shinyFeathers = (gameData.inventory && gameData.inventory['Shiny Feather']) || '0';
      const collectedFeathers = (gameData.farmActivity && gameData.farmActivity['Shiny Feather Collected']) || '0';
      
      console.log(`Inventory Shiny Feathers (Community): ${shinyFeathers.toString()}`);
      console.log(`farmActivity 'Shiny Feather Collected' (Community): ${collectedFeathers}`);
      
      fs.writeFileSync('src-backend/farm_92441_community_dump.json', JSON.stringify(data, null, 2));
      console.log('Saved dump to src-backend/farm_92441_community_dump.json');
    } else {
      console.log('No gameData found in the response.');
    }
  } catch (err) {
    console.error(err);
  }
}

checkCommunityApi();
