const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('C:/Users/Admin/.gemini/antigravity-ide/brain/d7e72b15-9c73-4dd4-b541-2f2e90bab976/.system_generated/steps/510/content.md', 'utf8');
const $ = cheerio.load(html);
const fishData = {};

$('tr.season-filter').each((i, el) => {
  const tds = $(el).find('td');
  if (tds.length >= 5) {
    const seasonsStr = $(tds[0]).text().trim(); // e.g. spring,summer,autumn,winter
    const name = $(tds[1]).text().trim();
    const baitImg = $(tds[2]).find('img').attr('src');
    let bait = 'Unknown';
    if (baitImg) {
      bait = baitImg.split('/').pop().replace('.png', '');
    }
    
    // Chum is in tds[3], there might be multiple. Let's take the first one
    const chums = [];
    $(tds[3]).find('img').each((j, img) => {
      const title = $(img).attr('title');
      if (title) chums.push(title);
    });
    
    const seasons = seasonsStr.split(',').filter(Boolean);
    
    if (name) {
      fishData[name] = { seasons, bait, chums };
    }
  }
});

fs.writeFileSync('src/data/fishData.json', JSON.stringify(fishData, null, 2));
console.log('Saved to fishData.json');
