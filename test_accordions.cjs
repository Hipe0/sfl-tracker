const cheerio = require('cheerio');

async function run() {
  const r = await fetch('https://sfl.world/land/6279470157500012');
  const html = await r.text();
  const $ = cheerio.load(html);
  
  $('.accordion-item').each((i, el) => {
    const titleText = $(el).find('.accordion-button').text().trim();
    console.log('Accordion Title:', titleText);
  });
}
run();
