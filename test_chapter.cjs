const fs = require('fs');
const cheerio = require('cheerio');

async function scrapeChapter() {
  const chapterHtml = await (await fetch('https://sfl.world/land/6279470157500012/chapter')).text();
  const $c = cheerio.load(chapterHtml);
  
  let result = {
    summary: { dailyChest: '', desertDigging: '', poppyBounty: '', table: [] },
    deliveries: [],
    chores: [],
    bounties: []
  };

  $c('.accordion-item').each((i, el) => {
    const title = $c(el).find('.accordion-button').text().trim();
    
    // 1. SUMMARY
    if (title === 'Summary') {
      const summaryBody = $c(el).find('.accordion-body');
      
      // Look for cchecklist items
      summaryBody.find('.cchecklist, .badge.text-bg-danger, .badge.text-bg-success').each((j, sEl) => {
        const text = $c(sEl).text().trim();
        if (text.includes('Daily chest')) result.summary.dailyChest = text.replace('Daily chest', '').trim();
        if (text.includes('Desert Digging')) result.summary.desertDigging = text.replace('Desert Digging', '').trim();
        if (text.includes('Poppy Bounty Bonus')) result.summary.poppyBounty = text.replace('Poppy Bounty Bonus', '').trim();
      });
      
      // Source/Total/Claimed/Left table
      summaryBody.find('table.p-2 tr').each((j, tr) => {
        const tds = $c(tr).find('td');
        if (tds.length === 5 && j > 0) {
          result.summary.table.push({
            source: $c(tds[0]).text().trim(),
            total: $c(tds[1]).text().trim(),
            claimed: $c(tds[2]).text().trim(),
            left: $c(tds[3]).text().trim(),
            percent: $c(tds[4]).text().trim()
          });
        }
      });
    }
    
    // 2. DELIVERY FOR TICKETS
    if (title.includes('Delivery for Tickets')) {
      const body = $c(el).find('.accordion-body');
      body.find('tr').each((j, trEl) => {
        const npcTd = $c(trEl).find('td').first();
        if (npcTd.length > 0 && npcTd.find('img').length > 0) {
          const npcImg = npcTd.find('img').attr('title');
          const npcName = npcImg ? npcImg.charAt(0).toUpperCase() + npcImg.slice(1) : 'Unknown';
          console.log("Found NPC in chapter:", npcName);
        }
      });
    }
  });
  
  console.log(JSON.stringify(result.summary, null, 2));
}

scrapeChapter();
