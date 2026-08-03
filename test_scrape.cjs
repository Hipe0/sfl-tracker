const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  const boostRes = await fetch('https://sfl.world/boost/6279470157500012');
  const boostHtml = await boostRes.text();
  const $b = cheerio.load(boostHtml);
  
  const toolCosts = {};
  
  $b('.accordion-item').each((i, el) => {
    const title = $b(el).find('.accordion-button').text().trim();
    if (title === 'Fishing') {
      const fishingHtml = $b(el).html();
      if (fishingHtml) {
        const rodMatch = fishingHtml.match(/Rod\.png.*?Flower\.png.*?fw-bold">([\d.]+)</);
        if (rodMatch) toolCosts['Rod'] = parseFloat(rodMatch[1]);
      }
    }
  });

  console.log('toolCosts:', toolCosts);
}
test();
