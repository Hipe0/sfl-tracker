const https = require('https'); 
https.get('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/treasure.ts', (resp) => { 
  let data = ''; 
  resp.on('data', chunk => data += chunk); 
  resp.on('end', () => { 
    console.log(data.substring(data.indexOf('Seaweed: {'), data.indexOf('Seaweed: {') + 100)); 
  }); 
});
