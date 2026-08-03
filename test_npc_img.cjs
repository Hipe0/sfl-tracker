const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('chapter.html', 'utf-8');
const $ = cheerio.load(html);
const imgs = $('img').map((i, el) => $(el).attr('src')).get();
const npcImgs = imgs.filter(src => src && (src.toLowerCase().includes('pharaoh') || src.toLowerCase().includes('jester')));
console.log(npcImgs);
