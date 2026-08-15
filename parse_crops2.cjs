const fs = require('fs');
const text = fs.readFileSync('crops.ts', 'utf8');

const regex = /([A-Z][a-zA-Z]+):\s*\{[\s\S]*?sellPrice:\s*([\d.]+)/g;
let match;
const crops = {};
while (match = regex.exec(text)) {
  crops[match[1]] = parseFloat(match[2]);
}
console.log("CROPS:", crops);
