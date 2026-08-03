const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  const boostRes = await fetch('https://sfl.world/boost/6279470157500012');
  const boostHtml = await boostRes.text();
  const $b = cheerio.load(boostHtml);
  
  const seedCosts = {};
  
  $b('.accordion-item').each((i, el) => {
    const title = $b(el).find('.accordion-button').text().trim();
    if (title === 'Crops' || title === 'Fruits') {
      let currentItem = null;
      $b(el).find('tbody tr').each((j, tr) => {
        const firstColText = $b(tr).find('td').first().text().replace(/\s+/g, ' ').trim();
        const firstColImg = $b(tr).find('td').first().find('img').first().attr('src');
        
        if (firstColImg && firstColImg.includes('/source/')) {
           currentItem = firstColText.toLowerCase();
        }
        
        if (currentItem) {
          const html = $b(tr).html();
          const seedMatch = html.match(/Seed FLW<\/span><span class="bval">([\d.]+)/);
          const harvestMatch = html.match(/Harvests<\/span><span class="bval">([\d.–-]+)/);
          
          if (seedMatch) {
            let harvests = 1; // Default for crops
            if (harvestMatch) {
              const hStr = harvestMatch[1];
              if (hStr.includes('–')) {
                const parts = hStr.split('–');
                harvests = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2;
              } else {
                harvests = parseFloat(hStr);
              }
            }
            seedCosts[currentItem] = { cost: parseFloat(seedMatch[1]), harvests };
            currentItem = null;
          }
        }
      });
    }
  });

  console.log('seedCosts:', seedCosts);
}
test();
