const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

async function run() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.goto('https://sfl.world/land/6279470157500012', { waitUntil: 'networkidle2' });
  const html = await page.content();
  const $ = cheerio.load(html);
  
  $('h4').each((i, el) => {
    const text = $(el).text().trim();
    if (text.includes('Deliver')) {
       console.log('Found Header:', text);
    }
  });

  await browser.close();
}
run();
