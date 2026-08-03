const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012')
  .then(r=>r.text())
  .then(html => {
    const $ = cheerio.load(html);
    $('#collapseChecklist').find('.badge').each((i, el) => {
      console.log($(el).text().trim(), $(el).attr('class'));
    });
  });
