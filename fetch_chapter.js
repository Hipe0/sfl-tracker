import * as cheerio from 'cheerio';

fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    $('.card').each((i, el) => {
      const title = $(el).find('.card-header').text();
      if (title.includes('Bounties')) {
        console.log('--- BOUNTIES RAW HTML ---');
        console.log($(el).html());
        console.log('--- BOUNTIES PARSING ---');
        $(el).find('tr').each((j, b) => {
           console.log('TR TEXT:', $(b).text().trim());
        });
        $(el).find('div.m-bottom-15').each((j, b) => {
           console.log('DIV TEXT:', $(b).text().trim());
        });
      }
      if (title.includes('Weekly Chores')) {
        console.log('--- CHORES RAW HTML ---');
        console.log($(el).html());
      }
    });
  });
