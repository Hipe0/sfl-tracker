const fs = require('fs');
const t = fs.readFileSync('sflworld.html', 'utf8');
const match = t.match(/(\d+[,.]\d*)\s*<\/div>\s*<img[^>]*src="[^"]*sfl\.webp"/);
if (match) {
  console.log('Regex 1 matched:', match[1]);
} else {
  const match2 = t.match(/>([\d,]+)</g); // Just look at numbers
  console.log('No direct match. Searching nearby sfl.webp...');
  const idx = t.indexOf('sfl.webp');
  if (idx > -1) {
    console.log(t.substring(Math.max(0, idx - 100), idx + 50));
  }
}
