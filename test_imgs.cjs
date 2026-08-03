const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012')
  .then(r=>r.text())
  .then(html => {
    const $ = cheerio.load(html);
    const imgs = new Set();
    $('img').each((i, el) => {
      imgs.add($(el).attr('src'));
    });
    console.log(Array.from(imgs).join('\n'));
  });
