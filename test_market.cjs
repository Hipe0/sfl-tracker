require('dotenv').config();
const { getMarketPrices } = require('./src-backend/services/sflApiService.cjs');

async function test() {
  const prices = await getMarketPrices();
  console.log("Prices:", prices);
}
test();
