const cheerio = require('cheerio');

fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(res => res.text())
  .then(html => {
      const $c = cheerio.load(html);
      let found = false;
      $c('.accordion-item').each((i, el) => {
        const titleText = $c(el).find('.accordion-button').text().trim();
        if (titleText.includes('Delivery for Tickets')) {
          found = true;
          const body = $c(el).find('.accordion-body');
          body.find('table.m-bottom-10').each((j, tableEl) => {
              const itemsTd = $c(tableEl).find('tbody > tr').first().find('td').eq(1);
              itemsTd.find('.badge').each((k, bEl) => {
                  console.log('--- BADGE ---');
                  console.log('badge HTML:', $c(bEl).html());
                  console.log('badge TEXT:', $c(bEl).text().trim());
              });
          });
        }
      });
      if (!found) console.log('No Delivery for Tickets found');
  });
