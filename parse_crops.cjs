const fs = require('fs');
const content = fs.readFileSync('crops.ts', 'utf8');

const result = {};
const lines = content.split('\n');
let currentCrop = null;

for (const line of lines) {
  const nameMatch = line.match(/^\s*([A-Z][a-zA-Z]+):\s*\{/);
  if (nameMatch) {
    currentCrop = nameMatch[1];
  }
  const priceMatch = line.match(/sellPrice:\s*([\d.]+)/);
  if (priceMatch && currentCrop) {
    result[currentCrop] = parseFloat(priceMatch[1]);
    currentCrop = null;
  }
}

console.log(JSON.stringify(result, null, 2));
