require('dotenv').config();

async function run() {
  const res = await fetch('https://api.sunflower-land.com/community/farms/6279470157500012', {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.farm.delivery.orders, null, 2));
}
run();
