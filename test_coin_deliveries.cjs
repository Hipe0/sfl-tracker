const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fs = require('fs');

async function run() {
  const r = await fetch('https://sfl.world/land/6279470157500012');
  const html = await r.text();
  const $ = cheerio.load(html);
  
  const results = [];
  
  $('.accordion-item').each((i, el) => {
    const titleText = $(el).find('.accordion-button').text().trim();
    if (titleText.includes('Delivery for Coins') || titleText.includes('Delivery for Flower')) {
      const body = $(el).find('.accordion-body');
      
      body.find('table.m-bottom-10').each((j, tableEl) => {
        const trEl = $(tableEl).find('tbody > tr').first();
        if (trEl.length === 0) return;
        
        const npcTd = trEl.find('td').first();
        let npcName = 'Unknown';
        if (npcTd.length > 0 && npcTd.find('img').length > 0) {
          const npcImg = npcTd.find('img').attr('title') || npcTd.find('img').attr('alt');
          if (npcImg) {
            npcName = npcImg.charAt(0).toUpperCase() + npcImg.slice(1);
          } else {
             npcName = $(tableEl).find('thead th').first().text().trim();
          }
        }
        
        const itemsTd = trEl.find('td').eq(1);
        const reqItems = [];
        itemsTd.find('.badge').each((k, bEl) => {
          const itemName = $(bEl).find('div').first().text().trim() || $(bEl).text().trim().split('\n')[0].trim();
          const bEl2 = $(bEl).find('b');
          const total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
          reqItems.push({ name: itemName, total });
        });
        
        // Find reward
        const rTrEl = $(tableEl).find('tbody > tr').eq(1);
        let reward = '';
        if (rTrEl.length > 0) {
           reward = rTrEl.find('td').eq(1).text().trim();
        }

        results.push({
          type: titleText.includes('Coins') ? 'Coins' : 'Flower',
          npcName,
          reqItems,
          reward
        });
      });
    }
  });
  
  console.log(JSON.stringify(results, null, 2));
}
run();
