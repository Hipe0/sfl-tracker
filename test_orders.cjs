require('dotenv').config();

async function run() {
  const farmId = '6279470157500012';
  const apiKey = process.env.SFL_API_KEY;
  const communityRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': apiKey }
  });
  if (communityRes.ok) {
    const resData = await communityRes.json();
    if (resData && resData.farm && resData.farm.delivery) {
      console.log('Orders:', JSON.stringify(resData.farm.delivery.orders, null, 2));
    }
  }
}
run();
