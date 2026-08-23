const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_boost2.html', 'utf8');
const $ = cheerio.load(html);

$('.accordion-item').each((i, el) => {
  const title = $(el).find('.accordion-button').text().trim();
  if (title.includes('Greenhouse')) {
    console.log("Found Greenhouse section:");
    
    $(el).find('tbody tr').each((j, tr) => {
        const text = $(tr).text().replace(/\s+/g, ' ').trim();
        console.log(text);
        
        // Let's also see the raw HTML of the row to see if skills are listed
        console.log($(tr).html().replace(/\s+/g, ' '));
    });
  }
});
