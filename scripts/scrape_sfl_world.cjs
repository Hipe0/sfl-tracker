const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  let csvUrl = '';
  
  page.on('request', request => {
    const url = request.url();
    if (url.endsWith('.csv')) {
      console.log('Intercepted CSV request:', url);
      csvUrl = url;
    }
  });

  await page.goto('https://sfl.world/tools/trade/?name=Stone', { waitUntil: 'networkidle2' });
  
  // Wait a bit for chart to load
  await new Promise(r => setTimeout(r, 3000));
  
  if (csvUrl) {
    console.log("Found CSV URL:", csvUrl);
    // Let's test downloading it directly via Node fetch. If Cloudflare blocks it, we can use puppeteer to download it.
  } else {
    console.log("No CSV request found.");
  }

  await browser.close();
})();
