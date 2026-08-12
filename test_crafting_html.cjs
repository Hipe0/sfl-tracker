const https = require('https');
const cheerio = require('cheerio');

https.get('https://sfl.world/info/crafting', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const $ = cheerio.load(data);
    $('.cursor-pointer').each((i, el) => {
      const name = $(el).find('.b').first().text().trim();
      if (name === 'Sand Drill') {
        console.log('Found Sand Drill HTML:');
        console.log($(el).html());
      }
    });
  });
});
