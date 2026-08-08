const cheerio = require('cheerio');
async function run() {
    const res = await fetch('https://sfl.world/land/8052347903218326');
    const text = await res.text();
    const $ = cheerio.load(text);
    console.log($('img[src*="bumpkin_image"]').attr('src'));
}
run();
