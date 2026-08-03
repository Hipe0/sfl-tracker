import * as cheerio from 'cheerio';

fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    $('.accordion-item').each((i, el) => {
      const title = $(el).find('.accordion-button').text();
      if (title.includes('Bounties')) {
        console.log('--- BOUNTIES RAW HTML ---');
        $(el).find('.badge').each((j, b) => {
          console.log($(b).html());
        });
      }
      if (title.includes('Weekly Chores')) {
        console.log('--- CHORES RAW HTML ---');
        $(el).find('.badge').each((j, b) => {
          console.log($(b).html());
        });
      }
    });
  });
