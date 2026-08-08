const fs = require('fs');
fetch('https://sfl.world/').then(r => r.text()).then(t => {
  const match2 = t.match(/>([\d,]+)</g); // Just look at numbers
  console.log('Searching nearby sfl.webp...');
  let idx = 0;
  while ((idx = t.indexOf('sfl.webp', idx + 1)) > -1) {
    console.log(t.substring(Math.max(0, idx - 100), idx + 50));
  }
});
