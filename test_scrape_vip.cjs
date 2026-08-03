const cheerio = require('cheerio');
fetch('https://sfl.world/cost/6279470157500012').then(r=>r.text()).then(t=>{ 
    const $ = cheerio.load(t); 
    $('tr').each((i, el)=>{ 
        const text = $(el).text();
        if(text.toLowerCase().includes('vip')) console.log($(el).text().replace(/\s+/g, ' ').trim()); 
    }) 
}).catch(console.error);
