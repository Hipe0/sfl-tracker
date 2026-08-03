import * as cheerio from 'cheerio';

fetch('https://sfl.world/farm/6279470157500012')
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    $('.card').each((i, el) => {
      const title = $(el).find('.card-header').text();
      if (title.includes('Bounties')) {
        $(el).find('.badge').each((j, b) => {
          console.log($(b).html());
          console.log('---');
        });
      }
    });
  });
