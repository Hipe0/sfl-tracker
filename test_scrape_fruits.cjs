const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  const boostRes = await fetch('https://sfl.world/boost/6279470157500012');
  const boostHtml = await boostRes.text();
  const $b = cheerio.load(boostHtml);
  
  $b('.accordion-item').each((i, el) => {
    const title = $b(el).find('.accordion-button').text().trim();
    if (title === 'Fruits') {
      const firstTr = $b(el).find('tbody tr').first();
      console.log('Fruits Row 1:', firstTr.text().replace(/\s+/g, ' ').trim());
      const secondTr = $b(el).find('tbody tr').eq(1);
      console.log('Fruits Row 2 HTML:', secondTr.html());
      const thirdTr = $b(el).find('tbody tr').eq(2);
      console.log('Fruits Row 3 HTML:', thirdTr.html());
    }
  });
}
test();
