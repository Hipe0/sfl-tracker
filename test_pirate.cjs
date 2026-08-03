const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(r=>r.text())
  .then(html => {
    const $ = cheerio.load(html);
    $('.badge').each((i, el) => {
      if($(el).text().includes('Pirate Chest')) console.log($(el).html());
    });
  });
