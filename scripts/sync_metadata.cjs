const fs = require('fs');
const path = require('path');

const SFL_REPO_PATH = path.join(__dirname, '../../');
const OUTPUT_PATH = path.join(__dirname, '../src/data/items_metadata.json');

// Helper to safely read file
function readFile(relativePath) {
  const fullPath = path.join(SFL_REPO_PATH, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[WARN] File not found: ${fullPath}`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function extractKeysFromString(text) {
  const keys = new Set();
  const keyRegex = /([a-zA-Z0-9_]+|["'][^"']+["'])\s*:/g;
  let m;
  while ((m = keyRegex.exec(text)) !== null) {
    let key = m[1];
    if (key.startsWith('"') || key.startsWith("'")) {
      key = key.slice(1, -1);
    }
    keys.add(key);
  }
  
  const unionRegex = /\|\s*["']([^"']+)["']/g;
  let u;
  while ((u = unionRegex.exec(text)) !== null) {
    keys.add(u[1]);
  }
  
  return keys;
}

// Regex to extract keys from a TS record/object export
function extractKeys(content, objectName) {
  const regex = new RegExp(`export const ${objectName}[\\s\\S]*?=\\s*{([\\s\\S]*?)^};`, 'm');
  const match = content.match(regex);
  if (match) {
    return Array.from(extractKeysFromString(match[1]));
  }
  return [];
}

// Custom extractors since some files might not use standard Record
function getWardrobeBuffs() {
  const content = readFile('src/features/game/types/bumpkinItemBuffs.ts');
  const keys = extractKeysFromString(content);
  keys.delete("id");
  keys.delete("name");
  keys.delete("description");
  return Array.from(keys);
}

function getCollectibleBuffs() {
  const content = readFile('src/features/game/types/collectibleItemBuffs.ts');
  return Array.from(extractKeysFromString(content));
}

function getKeysFromType(file, prefix) {
  const content = readFile(`src/features/game/types/${file}`);
  return Array.from(extractKeysFromString(content));
}

function getTradeableItems() {
  const content = readFile('src/features/game/types/withdrawables.ts');
  return Array.from(extractKeysFromString(content));
}

function generateMetadata() {
  console.log('🔄 Syncing metadata from SFL repo...');
  
  if (!fs.existsSync(SFL_REPO_PATH)) {
    console.error('❌ Could not find sunflower-land repository at:', SFL_REPO_PATH);
    console.error('Please ensure the sfl-tracker and sunflower-land folders are side-by-side.');
    process.exit(1);
  }

  // Broad extraction, we just scrape all string keys and categorize them
  // This is a simple robust regex that grabs names
  const tradeables = new Set(getTradeableItems());
  const wardrobeBuffs = new Set(getWardrobeBuffs());
  const collectibleBuffs = new Set(getCollectibleBuffs());
  
  const wardrobes = new Set(getKeysFromType('bumpkin.ts', ''));
  const collectibles = new Set(getKeysFromType('collectibles.ts', ''));
  
  // Non-NFT categories
  const fishes = new Set(getKeysFromType('fishing.ts', ''));
  const crops = new Set(getKeysFromType('crops.ts', ''));
  const resources = new Set(getKeysFromType('resources.ts', ''));
  const fruits = new Set(getKeysFromType('fruits.ts', ''));
  const consumables = new Set(getKeysFromType('consumables.ts', ''));
  const flowers = new Set(getKeysFromType('flowers.ts', ''));
  const animals = new Set(getKeysFromType('animals.ts', ''));
  const treasure = new Set(getKeysFromType('treasure.ts', ''));
  const garbage = new Set(getKeysFromType('garbage.ts', ''));
  const tools = new Set(getKeysFromType('tools.ts', ''));
  const composters = new Set(getKeysFromType('composters.ts', ''));
  const decorations = new Set(getKeysFromType('decorations.ts', ''));

  const allItems = new Set([
    ...tradeables, ...wardrobeBuffs, ...collectibleBuffs,
    ...wardrobes, ...collectibles, ...fishes, ...crops, ...resources, ...fruits, ...consumables,
    ...flowers, ...animals, ...treasure, ...garbage, ...tools, ...composters, ...decorations
  ]);

  const metadata = {};

  for (const item of allItems) {
    if (item.length < 3) continue; // Skip short garbage keys like id, x, y

    let type = 'other';
    if (wardrobes.has(item)) type = 'wardrobe';
    else if (collectibles.has(item)) type = 'collectible';
    else if (decorations.has(item)) type = 'decoration';
    else if (fishes.has(item)) type = 'fish';
    else if (crops.has(item)) type = 'crop';
    else if (fruits.has(item)) type = 'fruit';
    else if (resources.has(item)) type = 'resource';
    else if (consumables.has(item)) type = 'consumable';
    else if (flowers.has(item)) type = 'flower';
    else if (animals.has(item)) type = 'animal';
    else if (treasure.has(item)) type = 'treasure';
    else if (garbage.has(item)) type = 'garbage';
    else if (tools.has(item)) type = 'tool';
    else if (composters.has(item)) type = 'composter';

    const hasBuff = wardrobeBuffs.has(item) || collectibleBuffs.has(item);
    const isTradeable = tradeables.has(item);

    metadata[item] = {
      type,
      hasBuff,
      isTradeable
    };
  }

  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(metadata, null, 2));
  console.log(`✅ Metadata generated successfully at src/data/items_metadata.json!`);
  console.log(`Total items mapped: ${Object.keys(metadata).length}`);
}

generateMetadata();
