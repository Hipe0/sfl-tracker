const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(res => res.text())
  .then(html => {
      const $c = cheerio.load(html);
      $c('.accordion-item').each((i, el) => {
        const titleText = $c(el).find('.accordion-button').text().trim();
        if (titleText.includes('Delivery for Tickets')) {
          const body = $c(el).find('.accordion-body');
          body.find('table.m-bottom-10').each((j, tableEl) => {
              const trEl = $c(tableEl).find('tbody > tr').first();
              const itemsTd = trEl.find('td').eq(1);
              const rewardTable = itemsTd.find('table.p-2');
              console.log('--- REWARD TABLE ---');
              rewardTable.find('tr').each((k, rTrEl) => {
                 console.log('TEXT:', $c(rTrEl).text().trim());
                 console.log('HTML:', $c(rTrEl).html());
              });
          });
        }
      });
  });
