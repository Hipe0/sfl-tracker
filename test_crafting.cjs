const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('crafting.html', 'utf8');
const $c = cheerio.load(html);

const itemsToFind = ['Lumber Doll', 'Sizzle Doll', 'Harvest Doll', 'Moo Doll', 'Buzz Doll'];

$c('tr').each((i, el) => {
  const name = $c(el).find('td').first().text().trim();
  if (itemsToFind.some(item => name.includes(item))) {
    const costHtml = $c(el).find('td').eq(1).html();
    const costText = $c(el).find('td').eq(1).text().trim().replace(/\s+/g, ' ');
    console.log(`--- ${name} ---`);
    console.log('Cost Text:', costText);
    console.log('Cost HTML:', costHtml);
  }
});
