const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter').then(r=>r.text()).then(t=>{ 
    const $ = cheerio.load(t); 
    $('table').each((i, el)=>{ 
        if($(el).text().includes('Reward')) console.log($(el).text().replace(/\s+/g, ' ')); 
    }) 
}).catch(console.error);
