async function test() {
  const res = await fetch('https://sfl.world/api/v1/prices');
  const data = await res.json();
  const p2pPrices = data.data.p2p || {};
  
  const itemsToCheck = ['Feather', 'Merino Wool', 'Wool', 'Wood', 'Stone', 'Cobweb'];
  itemsToCheck.forEach(item => {
     const price = p2pPrices[item.toLowerCase()] || p2pPrices[item.toLowerCase().replace(/ /g, '_')] || p2pPrices[item];
     if (price !== undefined) {
       console.log(`${item}: ${price}`);
     } else {
       console.log(`${item}: Not found`);
     }
  });
  
  // Dump all keys
  console.log("All P2P Keys:", Object.keys(p2pPrices).slice(0, 50));
}
test();
