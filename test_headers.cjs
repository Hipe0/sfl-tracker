const cheerio = require('cheerio');

async function run() {
  const r = await fetch('https://sfl.world/land/6279470157500012');
  const html = await r.text();
  const $ = cheerio.load(html);
  $('h4').each((i, el) => {
    console.log($(el).text().trim());
  });
}
run();
