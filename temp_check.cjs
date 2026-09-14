const fs = require('fs');
const https = require('https');

https.get('https://sunflowermanager.xyz/static/js/main.66d1ba8b.js', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    // Look for fetch( or axios.get( patterns
    const endpoints = data.match(/['"](https:\/\/[^'"]+|[\/a-zA-Z0-9_-]+\/api\/[^'"]+)['"]/g) || [];
    console.log(Array.from(new Set(endpoints)));
  });
});
