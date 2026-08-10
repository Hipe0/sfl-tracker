const apiKey = process.env.SFL_API_KEY;
fetch(`https://api.sunflower-land.com/community/farms/1`, {
  headers: { 'x-api-key': apiKey }
}).then(r => r.json()).then(d => {
  const fs = require('fs');
  fs.writeFileSync('farm1.json', JSON.stringify(d, null, 2));
  console.log("Done");
}).catch(console.error);
