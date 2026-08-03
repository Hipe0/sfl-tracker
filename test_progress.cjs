require('dotenv').config();

async function test() {
  const farmId = '7787429634558352';
  const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  const farm = data.farm;

  console.log("choreBoard keys:", Object.keys(farm.choreBoard || {}));
  console.log("farmActivity:", Object.keys(farm.farmActivity || {}).slice(0, 10));
}
test();
