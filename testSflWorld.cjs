const cheerio = require('cheerio');
async function run() {
  const r = await fetch('https://sfl.world/land/6279470157500012');
  const html = await r.text();
  const $ = cheerio.load(html);
  console.log('H4:', $('td.ta-left.h4 a b').text());
  console.log('Level:', $('h5:contains("Level") b').text());
}
run();
