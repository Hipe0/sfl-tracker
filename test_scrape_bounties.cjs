const cheerio = require('cheerio');
fetch('https://sfl.world/land/6279470157500012/chapter').then(r=>r.text()).then(t=>{ 
    const $ = cheerio.load(t); 
    $('.badge').each((i, el)=>{ 
        if($(el).text().includes('Red Lotus')) {
            console.log("HTML:", $(el).html()); 
        }
    }) 
}).catch(console.error);
