const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012')
  .then(r => r.text())
  .then(html => {
    const $l = cheerio.load(html);
    const name = $l('td.ta-left.h4 a b').first().text().trim();
    console.log("Player name:", name);
  });
