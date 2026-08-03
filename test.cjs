const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_delivery.html', 'utf8');
const $ = cheerio.load(html);
let output = [];
$('.badge').each((i, el) => {
  if (i > 20 && i < 30) {
    output.push($(el).html());
  }
});
fs.writeFileSync('badges.txt', output.join('\n\n'));
