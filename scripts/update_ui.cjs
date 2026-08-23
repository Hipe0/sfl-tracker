const fs = require('fs');

// CHORES PANEL
let chores = fs.readFileSync('src/components/ChoresPanel.jsx', 'utf8');

chores = chores.replace(
  /import flowerRecipes from '\.\.\/data\/flowerRecipes\.json';/,
  "import flowerRecipes from '../data/flowerRecipes.json';\nimport cropRecipes from '../data/cropRecipes.json';"
);

chores = chores.replace(
  /import FlowerTooltip from '\.\/FlowerTooltip';/,
  "import FlowerTooltip from './FlowerTooltip';\nimport CropTooltip from './CropTooltip';"
);

chores = chores.replace(
  /className=\{flowerRecipes\[getChoreImage\(item\.name, item\.itemType\)\]/,
  "className={cropRecipes[getChoreImage(item.name, item.itemType)] || flowerRecipes[getChoreImage(item.name, item.itemType)]"
);

chores = chores.replace(
  /<FlowerTooltip flowerName=\{getChoreImage\(item\.name, item\.itemType\)\} farmData=\{farmData\} \/>/,
  "<CropTooltip cropName={getChoreImage(item.name, item.itemType)} farmData={farmData} />\n                            <FlowerTooltip flowerName={getChoreImage(item.name, item.itemType)} farmData={farmData} />"
);

fs.writeFileSync('src/components/ChoresPanel.jsx', chores);


// BOUNTIES PANEL
let bounties = fs.readFileSync('src/components/BountiesPanel.jsx', 'utf8');

bounties = bounties.replace(
  /import flowerRecipes from '\.\.\/data\/flowerRecipes\.json';/,
  "import flowerRecipes from '../data/flowerRecipes.json';\nimport cropRecipes from '../data/cropRecipes.json';"
);

bounties = bounties.replace(
  /import FlowerTooltip from '\.\/FlowerTooltip';/,
  "import FlowerTooltip from './FlowerTooltip';\nimport CropTooltip from './CropTooltip';"
);

bounties = bounties.replace(
  /className=\{flowerRecipes\[item\.name\]/,
  "className={cropRecipes[item.name] || flowerRecipes[item.name]"
);

bounties = bounties.replace(
  /<FlowerTooltip flowerName=\{item\.name\} farmData=\{farmData\} \/>/,
  "<CropTooltip cropName={item.name} farmData={farmData} />\n                    <FlowerTooltip flowerName={item.name} farmData={farmData} />"
);

fs.writeFileSync('src/components/BountiesPanel.jsx', bounties);

console.log('Updated Tooltips');
