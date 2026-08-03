async function test() {
  const res = await fetch('https://sfl.world/api/v1/prices');
  const prices = await res.json();
  const itemsToCheck = ['feather', 'merino_wool', 'merinowool', 'wool', 'wood', 'stone', 'cobweb'];
  itemsToCheck.forEach(item => {
     if (prices[item] !== undefined) {
       console.log(`${item}: ${prices[item]}`);
     } else {
       console.log(`${item}: Not found`);
     }
  });
}
test();
