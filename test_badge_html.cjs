const cheerio = require('cheerio');

async function test() {
  const farmId = '6279470157500012';
  const res = await fetch(`https://sfl.world/land/${farmId}/chapter`);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  $('.accordion-item').each((i, el) => {
    const title = $(el).find('.accordion-button').text().trim();
    if (title.includes('Delivery for Tickets')) {
      $(el).find('.accordion-body table.m-bottom-10').each((j, tableEl) => {
        const trEl = $(tableEl).find('tbody > tr').first();
        const npcTd = trEl.find('td').first();
        const npcImg = npcTd.find('img').attr('title');
        const npcName = npcImg ? npcImg.charAt(0).toUpperCase() + npcImg.slice(1) : $(tableEl).find('thead th').first().text().trim();
        
        if (npcName === 'Pharaoh' || npcName === 'Jester') {
          console.log(`\nNPC: ${npcName}`);
          const itemsTd = trEl.find('td').eq(1);
          itemsTd.find('.badge').each((k, bEl) => {
            console.log("Badge HTML:", $(bEl).html());
          });
        }
      });
    }
  });
}
test();
