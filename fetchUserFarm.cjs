const apiKey = process.env.SFL_API_KEY;
fetch(`https://api.sunflower-land.com/community/farms/6279470157500012`, {
  headers: { 'x-api-key': apiKey }
}).then(r => r.json()).then(d => {
  const fs = require('fs');
  fs.writeFileSync('farm_user.json', JSON.stringify(d, null, 2));
  console.log("Done");
}).catch(console.error);
