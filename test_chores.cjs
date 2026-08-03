require('dotenv').config();
const token = process.env.SFL_API_KEY;
const farmId = '6279470157500012';

async function testAPI() {
  const url = `https://api.sunflower-land.com/community/farms/${farmId}`;
  try {
    const res = await fetch(url, { headers: { 'x-api-key': token } });
    if (res.ok) {
      const data = await res.json();
      const chores = data.farm.choreBoard;
      console.log("Chores data:", JSON.stringify(chores, null, 2));
    } else {
      console.log("Failed");
    }
  } catch (e) {
    console.error(e);
  }
}
testAPI();
