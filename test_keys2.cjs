async function test() {
  const res = await fetch('https://sfl.world/api/v1/prices');
  const data = await res.json();
  const p2pPrices = data.data || {};
  
  console.log("Keys in p2pPrices:", Object.keys(p2pPrices).slice(0, 30));
  console.log("Wood:", p2pPrices.wood, p2pPrices.Wood);
  console.log("Feather:", p2pPrices.feather, p2pPrices.Feather);
}
test();
