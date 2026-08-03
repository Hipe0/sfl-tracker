const cheerio = require('cheerio');

async function test() {
  const farmId = '7787429634558352';
  const res = await fetch(`https://sfl.world/land/${farmId}/chapter`);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  $('.accordion-item').each((i, el) => {
    const title = $(el).find('.accordion-button').text().trim();
    if (title.includes('Weekly Chores')) {
      $(el).find('.accordion-body .badge').each((j, bEl) => {
        const text = $(bEl).text().trim().replace(/\s+/g, ' ');
        const htmlContent = $(bEl).html();
        if (text.includes('Fishing Rods') || text.includes('Mine 100 Stones')) {
          console.log("Found:", text);
          console.log("HTML:", htmlContent);
        }
      });
    }
  });
}
test();
