const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf8');

const oldFetch = `      let flowerUsdPrice = null;
      try {
        const geckoRes = await fetch('https://api.geckoterminal.com/api/v2/networks/base/pools/0xafe30319a948f322585fafc1cab1671a47eb3786');
        if (geckoRes.ok) {
          const geckoData = await geckoRes.json();
          flowerUsdPrice = Number(geckoData?.data?.attributes?.base_token_price_usd);
        }
      } catch (e) {
        console.error("GeckoTerminal fetch error:", e.message);
      }`;

const newFetch = `      let flowerUsdPrice = null;
      try {
        const sflRes = await fetch('https://sfl.world/api/v1.1/exchange');
        if (sflRes.ok) {
          const sflData = await sflRes.json();
          if (sflData && sflData.sfl && sflData.sfl.usd) {
            flowerUsdPrice = Number(sflData.sfl.usd);
          }
        }
      } catch (e) {
        console.error("SFL.world fetch error:", e.message);
      }`;

code = code.replace(oldFetch, newFetch);
fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Replaced GeckoTerminal API with sfl.world API');
