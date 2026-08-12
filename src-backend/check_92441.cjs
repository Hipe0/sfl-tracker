const fs = require('fs');
async function checkFarm() {
  const farmId = '92441';
  try {
    console.log(`Fetching data for farm ${farmId}...`);
    const sflRes = await fetch(`https://api.sunflower-land.com/visit/${farmId}`);
    if (!sflRes.ok) {
      console.error(`SFL API Error: ${sflRes.status}`);
      return;
    }
    const data = await sflRes.json();
    const gameData = data.state;
    
    const shinyFeathers = gameData.inventory['Shiny Feather'] || '0';
    const collectedFeathers = gameData.farmActivity['Shiny Feather Collected'] || 0;
    
    console.log(`Inventory Shiny Feathers: ${shinyFeathers.toString()}`);
    console.log(`farmActivity 'Shiny Feather Collected': ${collectedFeathers}`);
    
    fs.writeFileSync('farm_92441_dump.json', JSON.stringify(gameData, null, 2));
    console.log('Saved dump to farm_92441_dump.json');
  } catch (err) {
    console.error(err);
  }
}

checkFarm();
