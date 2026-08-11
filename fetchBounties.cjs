const https = require('https');

https.get('https://api.sunflower-land.com/visit/163846', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.state) {
        if (parsed.state.bounties) {
           console.log('--- bounties ---');
           console.log(JSON.stringify(parsed.state.bounties, null, 2));
        }
        if (parsed.state.megaBountyBoard) {
           console.log('--- megaBountyBoard ---');
           console.log(JSON.stringify(parsed.state.megaBountyBoard, null, 2));
        }
        
        // Print out any other top-level keys that contain 'bounty' or 'bonus'
        Object.keys(parsed.state).forEach(k => {
           if (k.toLowerCase().includes('bount') || k.toLowerCase().includes('bonus')) {
              console.log(`--- ${k} ---`);
              console.log(JSON.stringify(parsed.state[k], null, 2));
           }
        });
      }
    } catch(e) {
      console.log('Error parsing JSON:', e);
    }
  });
}).on('error', err => {
  console.log('Error:', err.message);
});
