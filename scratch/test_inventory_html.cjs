const fs = require('fs');
const cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('land.html'));
$('.accordion-item').each((i, el) => {
  if($(el).find('.accordion-button').text().trim() === 'Inventory') {
    console.log('Found Inventory!');
    $(el).find('.badge').slice(0,5).each((k, bEl) => {
      console.log($(bEl).text().replace(/\s+/g, ' ').trim());
    });
  }
});
