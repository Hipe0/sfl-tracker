const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_boost2.html', 'utf8');
const $ = cheerio.load(html);

$('.accordion-item').each((i, el) => {
  const title = $(el).find('.accordion-button').text().trim();
  if (title.includes('Greenhouse')) {
    console.log("Greenhouse Summary Text:");
    
    $(el).find('table').first().find('tbody tr').each((j, tr) => {
      const name = $(tr).find('td').eq(0).text().trim();
      const boost = $(tr).find('td').eq(1).text().trim();
      const cost = $(tr).find('td').eq(2).text().trim();
      console.log(name, boost, cost);
    });
  }
});
