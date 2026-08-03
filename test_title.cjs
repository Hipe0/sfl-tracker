const cheerio = require('cheerio');
const fs = require('fs');
const html = fs.readFileSync('land.html', 'utf-8');
const $ = cheerio.load(html);
console.log('Title:', $('title').text());
console.log('h1:', $('h1').text());
console.log('h2:', $('h2').text());
