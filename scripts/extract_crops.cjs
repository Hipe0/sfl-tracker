const fs = require('fs');

const text = fs.readFileSync('crops.ts', 'utf8');

const result = {};

// Regex matches the object keys block
const regex = /export const CROPS: Record<CropName, Crop> = \{([\s\S]*?)\};\n\nconst exotics/g;
const match = regex.exec(text);

if (match) {
  const block = match[1];
  
  // Extract each crop name and sellPrice
  // format is usually: CropName: { ... sellPrice: X, ... }
  const cropRegex = /"?([A-Za-z]+)"?:\s*\{[\s\S]*?sellPrice:\s*([\d.]+)/g;
  let cropMatch;
  while ((cropMatch = cropRegex.exec(block)) !== null) {
    result[cropMatch[1]] = parseFloat(cropMatch[2]);
  }
}

console.log(JSON.stringify(result, null, 2));
