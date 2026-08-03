const cheerio = require('cheerio');
async function test() {
  const res = await fetch(`https://sfl.world/land/6279470157500012/delivery`);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  $('.bg-light.b-b-1').each((i, el) => {
    console.log("== Delivery block ==");
    $(el).find('.badge').each((j, b) => {
      console.log($(b).text().replace(/\s+/g, ' ').trim());
    });
  });
}
test();
