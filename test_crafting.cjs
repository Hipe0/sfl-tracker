const https = require('https');
const cheerio = require('cheerio');

https.get('https://sfl.world/info/crafting', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const $ = cheerio.load(data);
    let sandDrill = null;
    $('.cursor-pointer').each((i, el) => {
      const name = $(el).find('.b').first().text().trim();
      if (name === 'Sand Drill') {
        sandDrill = $(el).find('.small b').first().text().trim();
      }
    });
    console.log('Scraped Sand Drill crafting cost from sfl.world/info/crafting:', sandDrill);
  });
});
