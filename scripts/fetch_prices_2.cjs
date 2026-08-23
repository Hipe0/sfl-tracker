const https = require('https'); 
function fetchParse(url) { 
  return new Promise(res => { 
    https.get(url, (resp) => { 
      let data = ''; 
      if (resp.statusCode !== 200) return res({});
      resp.on('data', chunk => data += chunk); 
      resp.on('end', () => { 
        const regex = /(?:\"?([A-Za-z ]+)\"?|([A-Za-z]+)):\s*\{[\s\S]*?sellPrice:\s*([\d.]+)/g; 
        const prices = {}; 
        let m; 
        while (m = regex.exec(data)) {
          const key = m[1] || m[2];
          if (key && !key.includes('description') && !key.includes('name')) {
             prices[key.trim()] = parseFloat(m[3]); 
          }
        }
        res(prices); 
      }); 
    }); 
  }); 
} 
Promise.all([
  fetchParse('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/resources.ts'), 
  fetchParse('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/composters.ts'),
  fetchParse('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/greenhouse.ts'),
  fetchParse('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/crops.ts')
]).then(results => console.log(JSON.stringify(Object.assign({}, ...results), null, 2)));
