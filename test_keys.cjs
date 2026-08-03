async function test() {
  const res = await fetch('https://sfl.world/api/v1/prices');
  const data = await res.json();
  const p2pPrices = data.data || {};
  
  const itemsToCheck = ['Feather', 'Merino Wool', 'Wool', 'Wood', 'Stone', 'Cobweb'];
  itemsToCheck.forEach(item => {
     if (p2pPrices[item] !== undefined) {
       console.log(`${item}: ${p2pPrices[item]}`);
     } else {
       console.log(`${item}: Not found`);
     }
  });
}
test();
