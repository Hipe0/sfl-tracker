const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('temp_boost2.html', 'utf8');
const $ = cheerio.load(html);
const toolCosts = {};

$('.accordion-item').each((i, el) => {
  const title = $(el).find('.accordion-button').text().trim();
  if (title === 'Greenhouse') {
    $(el).find('table').first().find('tbody tr').each((j, tr) => {
      const name = $(tr).find('td').eq(0).text().trim().toLowerCase();
      const costText = $(tr).find('td').eq(2).text().trim();
      const cost = parseFloat(costText.replace(/,/g, ''));
      if (name && !isNaN(cost)) {
        toolCosts[name] = { cost: cost, harvests: 1 };
      }
    });
  }
});
console.log(toolCosts);
