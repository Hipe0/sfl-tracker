const fs = require('fs');
require('dotenv').config();

const API_KEY = process.env.SFL_API_KEY;

async function testApis() {
  const headers = { 'x-api-key': API_KEY };
  
  console.log("Fetching auctions...");
  let res = await fetch('https://api.sunflower-land.com/community/data?type=auctions', { headers });
  let data = await res.json();
  fs.writeFileSync('auctions.json', JSON.stringify(data, null, 2));

  console.log("Fetching marketplaceActivity...");
  res = await fetch('https://api.sunflower-land.com/community/data?type=marketplaceActivity', { headers });
  data = await res.json();
  fs.writeFileSync('marketplace.json', JSON.stringify(data, null, 2));
  
  if (data.auctions && data.auctions.length > 0) {
    const aid = data.auctions[0].auctionId;
    console.log(`Fetching auctionResults for ${aid}...`);
    res = await fetch(`https://api.sunflower-land.com/community/data?type=auctionResults&auctionId=${aid}`, { headers });
    const resData = await res.json();
    fs.writeFileSync('auctionResults.json', JSON.stringify(resData, null, 2));
  }
}

testApis().catch(console.error);
