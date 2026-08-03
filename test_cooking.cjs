const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('cooking.html', 'utf8');
const $c = cheerio.load(html);

const cookingCosts = {};

$c('tbody tr').each((i, el) => {
  const name = $c(el).find('td').eq(1).text().trim();
  const sflText = $c(el).find('td').eq(3).text().trim();
  const cost = parseFloat(sflText);
  if (name && !isNaN(cost)) {
    cookingCosts[name] = cost;
  }
});

console.log('Extracted keys:', Object.keys(cookingCosts).slice(0, 15).join(', '));
