const fs = require('fs');

async function run() {
    const res = await fetch('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/bumpkin.ts');
    const text = await res.text();
    const match = text.match(/export const ITEM_IDS: Record<BumpkinItem, number> = {([\s\S]*?)}\s*;/);
    if (match) {
        let str = '{' + match[1] + '}';
        str = str.replace(/\/\/[^\n]*/g, '');
        str = str.replace(/([a-zA-Z0-9_\-\s']+?)\s*:/g, (m, p1) => {
            const k = p1.trim().replace(/^\"|\"$/g, '');
            return '"' + k + '":';
        });
        str = str.replace(/,\s*}/, '}');
        try {
            const obj = JSON.parse(str);
            fs.mkdirSync('src-backend/data', { recursive: true });
            fs.writeFileSync('src-backend/data/bumpkinWearables.json', JSON.stringify(obj, null, 2));
            console.log('Saved src-backend/data/bumpkinWearables.json');
        } catch (e) {
            console.error('JSON Parse error', e);
        }
    } else {
        console.log('No match');
    }
}
run();
