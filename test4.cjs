const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_farm.html', 'utf8');
const $ = cheerio.load(html);
let output = [];
$('.card').each((i, el) => {
  const title = $(el).find('.card-header').text();
  if (title.includes('Bounties')) {
    $(el).find('.badge').each((j, bEl) => {
      output.push($(bEl).html());
    });
  }
});
fs.writeFileSync('bounties_farm.txt', output.join('\n\n---\n\n'));
