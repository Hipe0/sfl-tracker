const fs = require('fs');
const cheerio = require('cheerio');
const $l = cheerio.load(fs.readFileSync('sflworld.html', 'utf8'));
$l('.accordion-item').each((i, el) => {
  const titleText = $l(el).find('.accordion-button').text().trim();
  if (titleText.includes('Delivery for Coins') || titleText.includes('Delivery for Flower')) {
    $l(el).find('.accordion-body table.m-bottom-10').each((j, tableEl) => {
      const rTrEl = $l(tableEl).find('tbody > tr').eq(1);
      console.log('Reward text:', rTrEl.text().trim().replace(/\s+/g, ' '));
    });
  }
});
