const cheerio = require('cheerio');

async function test() {
  const farmId = '7787429634558352';
  const res = await fetch(`https://sfl.world/land/${farmId}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  // Find buttons containing 'Update' or similar
  $('button, a').each((i, el) => {
    const text = $(el).text().toLowerCase();
    if (text.includes('update') || text.includes('refresh') || text.includes('sync')) {
      console.log("Found button text:", text);
      console.log("Attributes:", $(el).attr());
      // Check if it's inside a form
      const form = $(el).closest('form');
      if (form.length > 0) {
        console.log("Inside form with attributes:", form.attr());
      }
    }
  });

  // Also check for any script tags that might contain API routes for updating
  $('script').each((i, el) => {
    const content = $(el).html();
    if (content && content.includes('/update') || content && content.includes('/sync') || content && content.includes('fetch(')) {
      if (content.length < 500) { // only print small snippets
         console.log("Script snippet:", content);
      }
    }
  });
}
test();
