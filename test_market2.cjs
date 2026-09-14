require('dotenv').config();
const { fetchMarketplaceActivity } = require('./src-backend/services/sflApiService.cjs');

async function test() {
  const data = await fetchMarketplaceActivity();
  console.log("Keys:", Object.keys(data.items).slice(0, 5));
  console.log("Sample:", data.items[Object.keys(data.items)[0]]);
}
test();
