const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_delivery.html', 'utf8');
const $d = cheerio.load(html);
let found = false;
$d('tr').each((i, el) => {
  const td = $d(el).find('td').first();
  if (td.find('img').attr('title') === 'jester') {
    const td2 = $d(el).find('td').eq(1);
    console.log(td2.html());
    found = true;
  }
});
if(!found) console.log('Jester not found');
