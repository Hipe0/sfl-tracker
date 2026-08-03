require('dotenv').config();

async function test() {
  const farmId = '6279470157500012';
  const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  const farm = data.farm;

  if (farm.choreBoard && farm.choreBoard.chores) {
    const chores = Object.values(farm.choreBoard.chores);
    console.log(JSON.stringify(chores[0], null, 2));
  }
}
test();
