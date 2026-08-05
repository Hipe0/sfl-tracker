require('dotenv').config(); 
const cheerio = require('cheerio'); 
const fs = require('fs'); 
const html = fs.readFileSync('land.html'); 
const $l = cheerio.load(html); 
$l('.accordion-item').each((i, el) => { 
  const title = $l(el).find('.accordion-button').text().trim(); 
  if (title.includes('Delivery for Coins') || title.includes('Delivery for Flower')) { 
    $l(el).find('tbody > tr').each((j, trEl) => { 
      const itemsTd = $l(trEl).find('td').eq(1); 
      itemsTd.find('.badge').each((k, bEl) => { 
        const itemName = $l(bEl).find('div').first().text().trim() || $l(bEl).text().trim().split('\n')[0].trim(); 
        console.log('ItemName:', '[' + itemName + ']'); 
      }); 
    }); 
  } 
});
