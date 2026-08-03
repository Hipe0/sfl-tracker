const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter')
  .then(r=>r.text())
  .then(html => { 
    const $ = cheerio.load(html); 
    $('.badge').each((i, el) => { 
      const text = $(el).find('.ta-left').text(); 
      if(text.includes('Crimstone')) {
        console.log($(el).find('.ta-right, .ms-auto').last().html());
      }
    }); 
  });
