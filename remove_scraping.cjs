const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// 1. Remove cheerio require
code = code.replace(/const cheerio = require\('cheerio'\);\n/, '');

// 2. Remove all Promise.all HTML fetches
const fetchRegex = /const \[chapterRes[\s\S]*?\] = await Promise\.all\(\[[\s\S]*?\]\);/g;
code = code.replace(fetchRegex, `const [pricesRes] = await Promise.all([
      fetch('https://sfl.world/api/v1/prices')
    ]);`);

// 3. Keep p2pPrices but remove everything after it until '// 1. Parse Deliveries'
const p2pPricesIndex = code.indexOf('let p2pPrices = {};');
const parseDeliveriesIndex = code.indexOf('    // 1. Parse Deliveries');
if (p2pPricesIndex !== -1 && parseDeliveriesIndex !== -1) {
  // We need to keep p2pPrices logic
  const p2pPricesLogicEnd = code.indexOf('if (!chapterRes.ok)', p2pPricesIndex);
  const p2pPricesLogic = code.substring(p2pPricesIndex, p2pPricesLogicEnd);
  
  // We need to keep some summary initialization
  const summaryInit = `
    let summary = {
      dailyChest: null,
      desertDigging: null,
      poppyBounty: null,
      table: [],
      deliveryTotals: { tickets: 0, cost: '', claimed: 0 }
    };
    let deliveries = [];
    let chores = [];
    let bounties = [];
    let animals = [];
`;

  // We need to keep globalTicketBuff logic
  const globalTicketBuffRegex = /const animalNames[\s\S]*?globalTicketBuff = [^\n]*\n/g;
  let preDeliveries = '';
  const match = code.substring(p2pPricesLogicEnd, parseDeliveriesIndex).match(globalTicketBuffRegex);
  if (match) {
    preDeliveries = match[0];
  }

  code = code.substring(0, p2pPricesIndex) + 
         p2pPricesLogic + 
         summaryInit + '\n' +
         preDeliveries + '\n' +
         code.substring(parseDeliveriesIndex);
}

// 4. Remove craftingCosts references (since we deleted craftingCosts)
code = code.replace(/\|\| craftingCosts\[item\.name\] /g, '');
code = code.replace(/ craftingCosts\[b\.name\] !== undefined/g, ' false');

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Cleanup complete');
