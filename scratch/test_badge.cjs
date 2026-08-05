const fs = require('fs');
const cheerio = require('cheerio');
const $ = cheerio.load(fs.readFileSync('land.html'));
$('.badge').each((i, el) => {
   const text = $(el).text();
   if (text.includes('Kale') || text.includes('Wiggler')) {
      console.log('Found:', text.trim());
      console.log($(el).html());
   }
});
