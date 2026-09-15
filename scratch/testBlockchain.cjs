const { getSupplyStats } = require('./src-backend/services/blockchainService.cjs');
async function test() {
   const res = await getSupplyStats('Sunflower');
   console.log("Sunflower:", res);
}
test();
