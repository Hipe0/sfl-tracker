require('dotenv').config();
const cheerio = require('cheerio');

async function run() {
  const farmId = '6279470157500012';
  const apiKey = process.env.SFL_API_KEY;
  
  let gameData = null;
  const communityRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': apiKey }
  });
  if (communityRes.ok) {
    const resData = await communityRes.json();
    gameData = resData.farm;
  }
  
  const landRes = await fetch(`https://sfl.world/land/${farmId}`);
  const landHtml = await landRes.text();
  const $l = cheerio.load(landHtml);
  
  let coinDeliveries = [];
  let inventory = {};
  
  $l('.accordion-item').each((i, el) => {
    const titleText = $l(el).find('.accordion-button').text().trim();
    if (titleText.includes('Delivery for Coins') || titleText.includes('Delivery for Flower')) {
      const type = titleText.includes('Coins') ? 'coins' : 'sfl';
      $l(el).find('.accordion-body table.m-bottom-10').each((j, tableEl) => {
        const trEl = $l(tableEl).find('tbody > tr').first();
        if (trEl.length === 0) return;
        
        let npcName = 'Victoria'; // simplified
        
        const itemsTd = trEl.find('td').eq(1);
        const reqItems = [];
        itemsTd.find('.badge').each((k, bEl) => {
          const itemName = $l(bEl).find('div').first().text().trim() || $l(bEl).text().trim().split('\n')[0].trim();
          const bEl2 = $l(bEl).find('b');
          const total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
          
          let currAmt = 0;
          const inv = (gameData && gameData.inventory) ? gameData.inventory : inventory;
          if (inv) {
            let invKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
            if (invKey) {
              currAmt = parseFloat(inv[invKey]) || 0;
            } else {
              console.log(`invKey for ${itemName} not found!`);
              console.log(`Inventory keys similar to ${itemName}:`, Object.keys(inv).filter(k => k.toLowerCase().includes(itemName.toLowerCase())));
            }
          }
          
          reqItems.push({ name: itemName, total, completed: currAmt });
        });
        
        if (reqItems.length > 0) {
            coinDeliveries.push({ npcName, reqItems });
        }
      });
    }
  });
  
  console.log(JSON.stringify(coinDeliveries, null, 2));
}

run();
