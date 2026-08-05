const cheerio = require('cheerio');

fetch('https://sfl.world/land/6279470157500012').then(r => r.text()).then(html => {
   const $ = cheerio.load(html);
   $('.accordion-item').each((i, el) => {
      const title = $(el).find('.accordion-button').text().trim();
      if (title.includes('Deliveries')) {
         $(el).find('.badge').each((j, badge) => {
            console.log($(badge).html());
         });
      }
   });
});
