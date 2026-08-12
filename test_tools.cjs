const https = require('https');
const cheerio = require('cheerio');

https.get('https://sfl.world/land/92441', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const $ = cheerio.load(data);
    let toolCosts = {};
    let currentItem = null;
    $('.accordion-button').each((i, el) => {
      const title = $(el).text().trim();
      if (title.includes('Tools') || title.includes('Seeds')) {
        const body = $(el).closest('.accordion-item').find('.accordion-body');
        body.find('tr').each((j, trEl) => {
          const imgTitle = $(trEl).find('td').first().find('img').attr('title');
          if (imgTitle) currentItem = imgTitle.toLowerCase();
          
          const trText = $(trEl).text();
          const seedMatch = trText.match(/Cost.*?([\d.]+)\s*SFL/);
          if (seedMatch && currentItem) {
            toolCosts[currentItem] = seedMatch[1];
            currentItem = null;
          }
        });
      }
    });
    console.log(toolCosts);
  });
});
