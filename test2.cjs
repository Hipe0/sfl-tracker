const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_delivery.html', 'utf8');
const $ = cheerio.load(html);
let output = [];
$('.card').each((i, el) => {
  const title = $(el).find('.card-header').text();
  if (title.includes('Bounties')) {
    output.push($(el).html());
  }
});
fs.writeFileSync('bounties.txt', output.join('\n\n'));
