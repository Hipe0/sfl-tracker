const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(res => res.text())
  .then(html => {
      const $c = cheerio.load(html);
      $c('.accordion-item').each((i, el) => {
        const titleText = $c(el).find('.accordion-button').text().trim();
        if (titleText.includes('Bounties')) {
          console.log('--- BOUNTIES ACCORDION ---');
          $c(el).find('.badge').each((j, bEl) => {
             console.log('BADGE TEXT:', $c(bEl).text().trim());
             console.log('BADGE HTML:', $c(bEl).html());
          });
        }
      });
  });
