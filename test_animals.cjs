const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(res => res.text())
  .then(html => {
      const $c = cheerio.load(html);
      $c('.accordion-item').each((i, el) => {
        const titleText = $c(el).find('.accordion-button').text().trim();
        if (titleText.includes('Animals')) {
          console.log('--- ANIMALS HTML ---');
          const body = $c(el).find('.accordion-body');
          body.find('.w75').each((j, taskEl) => {
             console.log('HTML:', $c(taskEl).html());
          });
        }
      });
  });
