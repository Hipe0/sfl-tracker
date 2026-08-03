const cheerio = require('cheerio');
const html1 = `<table><tbody><tr><td class="va-middle ta-left">P2P <small>-10%</small></td><td class="ta-left"><img src="/img/Flower.png" class="w12 m-right-5"><b>1.43</b><span class="m-left-5">(0.20 per one)</span></td></tr></tbody></table>`;
const html2 = `<table><tbody><tr><td class="va-middle ta-left">P2P <small>-10%</small></td><td class="ta-left"><img src="/img/Flower.png" class="w12 m-right-5">4.25<span class="m-left-5">(0.42 per one)</span></td></tr></tbody></table>`;

function parse(html) {
  const $c = cheerio.load(html);
  let totalCost = '';
  let costPerTicket = '';
  $c('tr').each((k, rTrEl) => {
    const trText = $c(rTrEl).text();
    if (trText.includes('P2P') || trText.includes('per one')) {
      const td1Text = $c(rTrEl).find('td').eq(1).text().trim();
      const match = td1Text.match(/^([\d.]+)/);
      if (match) totalCost = match[1];
      
      const p2pSpan = $c(rTrEl).find('span').last();
      if (p2pSpan.length > 0 && p2pSpan.text().includes('per one')) {
        costPerTicket = p2pSpan.text().replace(/[()]/g, '').trim();
      } else {
        const spanMatch = trText.match(/\((.*?per one.*?)\)/);
        if (spanMatch) costPerTicket = spanMatch[1];
      }
    }
  });
  console.log({ totalCost, costPerTicket });
}

parse(html1);
parse(html2);
