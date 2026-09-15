const fs = require('fs');
const lines = fs.readFileSync('scratch/sfl-repo/src/features/game/types/index.ts', 'utf8');
const regex = /\"?([A-Za-z0-9 ]+)\"?: (\d+),/g;
let match;
const map = {};
while ((match = regex.exec(lines)) !== null) {
  map[match[1]] = parseInt(match[2]);
}
fs.writeFileSync('src/data/tokenIds.json', JSON.stringify(map, null, 2));
