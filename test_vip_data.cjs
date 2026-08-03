require('dotenv').config();

async function checkVIP() {
  const farmId = '6279470157500012';
  const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  const farm = data.farm;

  console.log("VIP data:", JSON.stringify(farm.vip, null, 2));
}
checkVIP();
