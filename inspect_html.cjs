const cheerio = require('cheerio');
const fs = require('fs');

const htmlDelivery = fs.readFileSync('temp_delivery.html', 'utf8');
const $d = cheerio.load(htmlDelivery);
console.log("=== Deliveries ===");
$d('.badge').each((i, el) => {
  const text = $d(el).text().replace(/\s+/g, ' ').trim();
  if (text.includes('Salt Rock')) console.log(text.substring(0, 100));
});

const htmlCost = fs.readFileSync('temp_cost.html', 'utf8');
const $c = cheerio.load(htmlCost);
console.log("=== Cost/NFTs ===");
$c('.row.bg-light').each((i, el) => {
  const name = $c(el).find('a').text().trim();
  const count = $c(el).find('.text-end').text().trim();
  if (name.includes('Spa')) {
    console.log(name, count);
  }
});
