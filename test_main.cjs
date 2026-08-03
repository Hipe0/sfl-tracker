const cheerio = require('cheerio');

async function test() {
  const res = await fetch('https://sfl.world/land/6279470157500012');
  const html = await res.text();
  const $c = cheerio.load(html);
  
  $c('.accordion-item').each((i, el) => {
    const titleText = $c(el).find('.accordion-button').text().trim();
    if (titleText === 'Checklist') {
      console.log("Found Checklist. Items:");
      $c(el).find('.cchecklist').each((j, sEl) => {
        console.log("- HTML:", $c(sEl).html());
      });
    }
  });
}
test();
