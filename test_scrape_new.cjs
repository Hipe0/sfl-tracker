const fs = require('fs');
const cheerio = require('cheerio');

const boostHtml = fs.readFileSync('boost.html', 'utf8');
const $b = cheerio.load(boostHtml);
let coinRate = null;
$b('div, span, button, a, .badge').each((i, el) => {
    const text = $b(el).text();
    const match = text.match(/Coin rate 1:([0-9,.]+)/);
    if(match) coinRate = match[1];
});
console.log('Coin Rate:', coinRate);

const landHtml = fs.readFileSync('land.html', 'utf8');
const $l = cheerio.load(landHtml);
let island = null;
let tax = null;

$l('tr').each((i, el) => {
    const td1 = $l(el).find('td').eq(0).text().trim();
    const td2 = $l(el).find('td').eq(1).text().trim();
    if(td1 === 'Island') island = td2;
    if(td1 === 'Resource Tax') tax = td2;
});

console.log('Island:', island);
console.log('Tax:', tax);
