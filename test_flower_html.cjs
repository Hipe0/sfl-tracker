const fs = require('fs');
const cheerio = require('cheerio');
const content = fs.readFileSync('sflworld.html', 'utf8');
const $ = cheerio.load(content);
$('.accordion-item').each((i, el) => {
  const title = $(el).find('.accordion-button').text().trim();
  if (title.includes('Flower')) {
    console.log($(el).find('.accordion-body').html());
  }
});
