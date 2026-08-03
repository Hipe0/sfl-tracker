const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('crafting.html', 'utf8');
const $c = cheerio.load(html);

const craftingCosts = {};
$c('.cursor-pointer').each((i, el) => {
  const name = $c(el).find('.b').first().text().trim();
  const costText = $c(el).find('.small b').first().text().trim();
  const cost = parseFloat(costText);
  if (name && !isNaN(cost)) {
    craftingCosts[name] = cost;
  }
});

console.log(craftingCosts['Moo Doll']);
console.log(craftingCosts['Lumber Doll']);
console.log(craftingCosts['Sizzle Doll']);
console.log(Object.keys(craftingCosts).length, "items extracted");
