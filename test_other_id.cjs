require('dotenv').config();

async function test() {
  const farmId = '7787429634558352';
  const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  const farm = data.farm;

  if (farm.choreBoard && farm.choreBoard.chores) {
    const chores = Object.values(farm.choreBoard.chores);
    console.log("Chores in API:", chores.length);
    chores.slice(0, 5).forEach(c => {
      console.log(`${c.name} - Reward:`, JSON.stringify(c.reward));
    });
  } else {
    console.log("No choreBoard found for this ID.");
  }
}
test();
