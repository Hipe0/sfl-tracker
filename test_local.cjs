const fetch = require('node-fetch');

// If using native fetch in Node 18+:
fetch('http://localhost:3001/api/farm/6279470157500012')
  .then(res => res.json())
  .then(data => {
      console.log('Result:', JSON.stringify(data, null, 2).substring(0, 1000));
  }).catch(e => console.log('Error:', e.message));
