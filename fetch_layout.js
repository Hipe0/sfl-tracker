import * as cheerio from 'cheerio';

fetch('https://sfl.world/farm/6279470157500012')
  .then(r => r.text())
  .then(html => {
    const $ = cheerio.load(html);
    console.log('Total cards:', $('.card').length);
    $('.card').each((i, el) => {
      console.log('Card title:', $(el).find('.card-header').text().trim());
    });
    
    console.log('\nAll h5 tags (often used for panel titles):');
    $('h5').each((i, el) => console.log($(el).text().trim()));
    
    console.log('\nLooking for bounties anywhere:');
    $('*').each((i, el) => {
       if($(el).text().trim() === 'Bounties') {
         console.log('Found Bounties element:', el.tagName, $(el).attr('class'));
       }
    });
  });
