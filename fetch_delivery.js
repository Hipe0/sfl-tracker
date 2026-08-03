import * as cheerio from 'cheerio';

fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    $('.accordion-item').each((i, el) => {
      const title = $(el).find('.accordion-button').text();
      if (title.includes('Delivery')) {
        console.log('--- DELIVERY RAW HTML ---');
        console.log($(el).html());
      }
    });
  });
