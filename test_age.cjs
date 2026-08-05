require('dotenv').config();

async function run() {
  const farmId = '6279470157500012';
  const apiKey = process.env.SFL_API_KEY;
  const communityRes = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': apiKey }
  });
  if (communityRes.ok) {
    const resData = await communityRes.json();
    if (resData && resData.farm && resData.farm.delivery && resData.farm.delivery.orders) {
      const now = Date.now();
      console.log('Current time:', now);
      resData.farm.delivery.orders.forEach(o => {
        if (o.from === 'grubnuk' || o.from === 'gordo' || o.from === 'guria') {
          const ageHours = (now - o.createdAt) / (1000 * 60 * 60);
          console.log(o.from, 'age hours:', ageHours);
        }
      });
    }
  }
}
run();
