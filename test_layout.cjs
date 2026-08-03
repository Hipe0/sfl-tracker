const fs = require('fs');
const cheerio = require('cheerio');

async function check() {
  const chapterHtml = await (await fetch('https://sfl.world/land/6279470157500012/chapter')).text();
  const $c = cheerio.load(chapterHtml);
  
  $c('.accordion-item').each((i, el) => {
    const title = $c(el).find('.accordion-button').text().trim();
    if (title.includes('Delivery for Tickets')) {
      console.log('--- Delivery for Tickets HTML ---');
      console.log($c(el).html().substring(0, 1000));
    }
    if (title === 'Summary') {
      console.log('--- Summary HTML ---');
      console.log($c(el).html().substring(0, 1000));
    }
  });
}

check();
