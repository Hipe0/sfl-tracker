const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_delivery.html', 'utf8');
const $ = cheerio.load(html);
$('.card').each((i, el) => {
  console.log($(el).find('.card-header').text().trim());
});
