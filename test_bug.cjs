const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('chapter.html', 'utf8');
const $c = cheerio.load(html);

$c('.accordion-item').each((i, el) => {
  const titleText = $c(el).find('.accordion-button').text().trim();
  if (titleText.includes('Bounties')) {
    $c(el).find('.badge').each((j, bEl) => {
      const choreText = $c(bEl).find('.ta-left').text().trim();
      let completed = 0, total = 0, reward = 0;
      const rightDiv = $c(bEl).find('.ta-right, .ms-auto').first();
      
      if (rightDiv.length > 0) {
        const children = rightDiv.children();
        const rewardText = children.last().text().trim();
        const progressText = children.length >= 2 ? children.eq(-2).text().trim() : children.first().text().trim();
        
        const pMatch = progressText.match(/([0-9,]+)\s*\/\s*([0-9,]+)/);
        if (pMatch) {
          completed = parseInt(pMatch[1].replace(/,/g, ''));
          total = parseInt(pMatch[2].replace(/,/g, ''));
        } else {
          const singleMatch = progressText.match(/([0-9,]+)/);
          if (singleMatch) {
            total = parseInt(singleMatch[1].replace(/,/g, ''));
            completed = total;
          }
        }
      }
      console.log(`${choreText} -> ${completed} / ${total}`);
    });
  }
});
