const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  const boostRes = await fetch('https://sfl.world/boost/6279470157500012');
  const boostHtml = await boostRes.text();
  const $b = cheerio.load(boostHtml);
  
  $b('.accordion-item').each((i, el) => {
    const title = $b(el).find('.accordion-button').text().trim();
    if (title === 'Resources') {
      let printNext = false;
      $b(el).find('tbody tr').each((j, tr) => {
        const text = $b(tr).text();
        if (text.match(/^Wood⛏/)) {
          printNext = true;
          console.log('WOOD ROW:', text.replace(/\s+/g, ' ').trim());
        } else if (printNext) {
          console.log('DETAIL ROW:', $b(tr).html());
          printNext = false;
        }
      });
    }
  });
}
test();
