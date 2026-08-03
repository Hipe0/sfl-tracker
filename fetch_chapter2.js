import * as cheerio from 'cheerio';

fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(r => r.text())
  .then(html => {
     console.log(html.substring(0, 1000));
     console.log('---');
     const $ = cheerio.load(html);
     $('h5').each((i, el) => console.log($(el).text().trim()));
     $('.card-header').each((i, el) => console.log($(el).text().trim()));
  });
