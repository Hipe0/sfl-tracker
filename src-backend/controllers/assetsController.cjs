const fs = require('fs');
const path = require('path');

let assetsMapCache = null;

const buildAssetsMap = (dir, baseDir, map) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      buildAssetsMap(fullPath, baseDir, map);
    } else {
      // extensions like .png, .webp, .gif
      const ext = path.extname(file).toLowerCase();
      if (['.png', '.webp', '.gif', '.jpg', '.jpeg'].includes(ext)) {
        const basename = path.basename(file, ext);
        // Normalize name to be used as key
        // We'll map the exact basename in lowercase, but also without spaces/underscores
        const key = basename.toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/ /g, '');
        // Path relative to assets folder
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        
        // We prefer webp if there are duplicates, or just keep the first one
        if (!map[key] || ext === '.webp') {
          map[key] = `/sfl-assets/${relPath}`;
        }
      }
    }
  }
};

exports.getAssetsMap = (req, res) => {
  try {
    if (!assetsMapCache) {
      // __dirname is d:\sunflower-land\sfl-tracker\src-backend\controllers
      // We want d:\sunflower-land\src\assets
      const assetsDir = path.join(__dirname, '../../../src/assets');
      const map = {};
      if (fs.existsSync(assetsDir)) {
        buildAssetsMap(assetsDir, assetsDir, map);
        
        // Cập nhật alias cho wearables từ bumpkin.ts
        const bumpkinTsPath = path.join(__dirname, '../../../src/features/game/types/bumpkin.ts');
        if (fs.existsSync(bumpkinTsPath)) {
          try {
            const content = fs.readFileSync(bumpkinTsPath, 'utf8');
            const startIndex = content.indexOf('export const ITEM_IDS');
            if (startIndex !== -1) {
              const openBrace = content.indexOf('{', startIndex);
              let braceCount = 1;
              let endIndex = openBrace + 1;
              while(braceCount > 0 && endIndex < content.length) {
                  if (content[endIndex] === '{') braceCount++;
                  if (content[endIndex] === '}') braceCount--;
                  endIndex++;
              }
              const block = content.substring(openBrace + 1, endIndex - 1);
              const lines = block.split('\n');
              for (const line of lines) {
                const parts = line.split(':');
                if (parts.length >= 2) {
                  const nameRaw = parts[0].trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
                  const idRaw = parts[1].trim().replace(/,$/, '').replace(/"/g, '');
                  if (nameRaw && idRaw && map[idRaw]) {
                    const key = nameRaw.toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/ /g, '');
                    map[key] = map[idRaw];
                  }
                }
              }
            }
          } catch (e) {
            console.error("Error parsing bumpkin.ts for wearable aliases:", e);
          }
        }
      }
      assetsMapCache = map;
    }
    res.json({ success: true, data: assetsMapCache });
  } catch (err) {
    console.error("Error building assets map:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
