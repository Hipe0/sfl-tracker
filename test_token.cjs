require('dotenv').config();
const token = process.env.SFL_API_KEY;
const farmId = '6279470157500012';

async function testAPI() {
  const url = `https://api.sunflower-land.com/community/farms/${farmId}`;
  try {
    const res = await fetch(url, { headers: { 'x-api-key': token } });
    if (res.ok) {
      const data = await res.json();
      console.log("Delivery fulfilled array length:", data.farm.delivery.fulfilled?.length || 0);
      if (data.farm.delivery.fulfilled && data.farm.delivery.fulfilled.length > 0) {
          console.log(JSON.stringify(data.farm.delivery.fulfilled.slice(-2), null, 2));
      }
    } else {
      console.log("Failed");
    }
  } catch (e) {}
}
testAPI();
