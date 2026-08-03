const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  const url = 'https://sfl.world/info/fishing/info';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const crustPrices = {};
  
  $('table tbody tr').each((i, el) => {
    const firstTd = $(el).find('td').first();
    const name = firstTd.text().trim();
    if (name) {
      const lastTd = $(el).find('td').last();
      const htmlLast = lastTd.html() || '';
      if (htmlLast.includes('Flower.png')) {
        const textLast = lastTd.text().trim();
        const price = parseFloat(textLast.replace(/[^\d.]/g, ''));
        if (!isNaN(price)) {
          crustPrices[name] = price;
        }
      }
    }
  });
  
  console.log(crustPrices);
}

test();
