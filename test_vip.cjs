require('dotenv').config();

async function checkVIP() {
  const farmId = '6279470157500012';
  const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  const farm = data.farm;

  console.log("Farm keys:", Object.keys(farm));
  
  if (farm.inventory['VIP Ticket']) console.log("Has VIP Ticket in inventory");
  if (farm.inventory['Lifetime VIP']) console.log("Has Lifetime VIP in inventory");
  
  // Just dump everything matching VIP
  const allKeys = [...Object.keys(farm.inventory || {}), ...Object.keys(farm.wardrobe || {})];
  const vipKeys = allKeys.filter(k => k.toLowerCase().includes('vip'));
  console.log("VIP Keys found:", vipKeys);
}
checkVIP();
