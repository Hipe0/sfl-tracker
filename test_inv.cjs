const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('cost.html', 'utf8');
const $c = cheerio.load(html);
$c('tr').each((i, el) => {
    const name = $c(el).find('a').text().trim();
    const q = $c(el).find('.ta-right div').text().trim();
    if(parseInt(q.replace(/[^0-9]/g, '')) > 0) {
        console.log(name, q);
    }
});
