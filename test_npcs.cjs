const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_delivery.html', 'utf8');
const $ = cheerio.load(html);
$('tr').each((i, el) => {
  const td = $(el).find('td').first();
  if (td.find('img').attr('title') === 'betty') {
    console.log($(el).html());
  }
});
