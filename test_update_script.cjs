const cheerio = require('cheerio');

async function test() {
  const farmId = '7787429634558352';
  const res = await fetch(`https://sfl.world/land/${farmId}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const scripts = [];
  $('script[src]').each((i, el) => {
    scripts.push($(el).attr('src'));
  });
  console.log("External scripts:", scripts);
  
  // also let's check for inline scripts
  let found = false;
  $('script:not([src])').each((i, el) => {
    const code = $(el).html();
    if (code.includes('function update(') || code.includes('const update =')) {
      console.log("Found inline update function!");
      console.log(code.substring(0, 1000)); // print first 1000 chars
      found = true;
    }
  });
}
test();
