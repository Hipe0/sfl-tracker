const fs = require('fs');
const path = require('path');

const GAME_DIR = 'd:\\sunflower-land';
const DICTIONARY_PATH = path.join(GAME_DIR, 'src/lib/i18n/dictionaries/en.json');
const BUFF_FILES = [
  'src/features/game/types/bumpkinItemBuffs.ts',
  'src/features/game/types/collectibleItemBuffs.ts',
  'src/features/game/types/getPetBuffs.ts',
  'src/features/game/types/collectibles.ts',
  'src/features/game/types/budBuffs.ts'
];
const OUTPUT_PATH = path.join(__dirname, 'src/data/buffs.json');

function main() {
  if (!fs.existsSync(DICTIONARY_PATH)) {
    console.error("Dictionary not found:", DICTIONARY_PATH);
    return;
  }
  
  const dictionary = JSON.parse(fs.readFileSync(DICTIONARY_PATH, 'utf8'));
  const allBuffs = {};

  // Preserve existing buffs in case some are not caught by our regex
  if (fs.existsSync(OUTPUT_PATH)) {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
    Object.assign(allBuffs, existing);
  }

  for (const relPath of BUFF_FILES) {
    const filePath = path.join(GAME_DIR, relPath);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    
    // We want to find blocks like: "Item Name": [ ... ] or ItemName: { ... }
    // We'll use a regex that finds a key (quoted or unquoted word), followed by ":"
    // Then we look ahead to find 'shortDescription: translate("...")' or 'boost: translate("...")' or 'shortDescription: "..."'
    
    // Split the file into chunks by object keys at the root level of the exported objects
    // A simple heuristic: find lines that start with 2 or 4 spaces followed by a key
    const lines = content.split('\n');
    let currentItem = null;
    let itemBuffs = [];

    const saveCurrentItem = () => {
      if (currentItem && itemBuffs.length > 0) {
        // Remove duplicates and clean
        const uniqueBuffs = [...new Set(itemBuffs)].filter(b => b);
        if (uniqueBuffs.length > 0) {
          allBuffs[currentItem] = uniqueBuffs;
        }
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match "Item Name": or ItemName: at the beginning of an indentation block
      const itemMatch = line.match(/^ {2,4}"?([a-zA-Z0-9 '\-]+)"?:\s*(?:\[|\{|\()/);
      if (itemMatch) {
        saveCurrentItem();
        currentItem = itemMatch[1].trim();
        itemBuffs = [];
        continue;
      }
      
      // We are inside an item block. Look for shortDescription or boost
      // e.g. shortDescription: translate("some.key")
      // e.g. shortDescription: "Some plain text"
      // e.g. boost: translate("some.key")
      
      const descMatch = line.match(/(?:shortDescription|boost)\s*:\s*(.+)/);
      if (descMatch && currentItem) {
        let val = descMatch[1].trim();
        if (val.endsWith(',')) val = val.slice(0, -1);
        
        // Is it a translate call?
        const tMatch = val.match(/translate\(\s*["']([^"']+)["']\s*\)/);
        if (tMatch) {
          const tKey = tMatch[1];
          const text = dictionary[tKey];
          if (text) itemBuffs.push(text);
        } else if (val.startsWith('"') || val.startsWith("'")) {
          // Plain string
          itemBuffs.push(val.slice(1, -1));
        } else if (val === 'translate(') {
          // Multiline translate call, e.g.:
          // shortDescription: translate(
          //   "some.key"
          // )
          let nextLine = lines[i+1]?.trim() || '';
          const tMatchMulti = nextLine.match(/["']([^"']+)["']/);
          if (tMatchMulti) {
            const tKey = tMatchMulti[1];
            const text = dictionary[tKey];
            if (text) itemBuffs.push(text);
          }
        }
      }
    }
    saveCurrentItem();
  }

  // Cleanup potential garbage keys
  const cleanBuffs = {};
  for (const [k, v] of Object.entries(allBuffs)) {
      if (k.length > 2 && !k.startsWith('//') && !k.includes('return') && !k.includes('(')) {
          cleanBuffs[k] = v;
      }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cleanBuffs, null, 2));
  console.log(`Successfully extracted and updated buffs for ${Object.keys(cleanBuffs).length} items.`);
}

main();
