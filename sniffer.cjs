const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('history') || url.includes('prices') || url.includes('chart') || url.includes('ohlc')) {
      console.log('Intercepted:', url);
    }
  });

  await page.goto('https://sunflowermanager.xyz/', { waitUntil: 'networkidle2' });
  
  // Type farm id
  await page.type('input', '1'); // The first input on the page is usually the farm ID
  await page.keyboard.press('Enter');
  
  // Wait for the Farm table to load
  await new Promise(r => setTimeout(r, 5000));
  
  // Try to find the Market text and click it
  const elements = await page.$$('text/Market');
  if (elements.length > 0) {
      await elements[0].click();
      console.log("Clicked Market!");
  } else {
      // Find the first SVG or button that might be a chart icon
      const ths = await page.$$('th');
      for (const th of ths) {
          const text = await page.evaluate(el => el.textContent, th);
          if (text && text.includes('Market')) {
              await th.click();
              console.log("Clicked Market header/column");
          }
      }
  }

  await new Promise(r => setTimeout(r, 4000));
  await browser.close();
})();
