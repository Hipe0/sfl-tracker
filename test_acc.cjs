const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('chapter.html', 'utf8');
const $c = cheerio.load(html);
$c('.accordion-button').each((i, el) => console.log($c(el).text().trim()));
