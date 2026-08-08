const fs = require('fs');
const cheerio = require('cheerio');
const t = fs.readFileSync('sflworld.html', 'utf8');
const $ = cheerio.load(t);
$('div, span, p, td').each((i, el) => {
  const txt = $(el).text();
  if (txt.includes('SFL') && /\d/.test(txt)) {
    console.log(txt.trim());
  }
});
