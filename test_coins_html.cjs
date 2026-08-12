const https = require('https');
const cheerio = require('cheerio');

https.get('https://sfl.world/land/92441/chapter', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const $ = cheerio.load(data);
    let found = false;
    $('.accordion-item').each((i, el) => {
      const title = $(el).find('.accordion-button').text().trim();
      if (title.includes('Coins')) {
        console.log('Found Coins section:');
        console.log($(el).find('.accordion-body').html());
        found = true;
      }
    });
    if (!found) console.log('Not found');
  });
});
