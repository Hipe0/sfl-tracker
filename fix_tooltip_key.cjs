const fs = require('fs');

let code = fs.readFileSync('src/components/ChoresPanel.jsx', 'utf8');

const tooltipKeyFunc = `
  const getTooltipKey = (name, itemType) => {
    if (itemType && !name.includes('Fish') && !name.includes('Egg') && !name.includes('Milk')) return itemType;
    if (name.includes('Fish')) return 'Fishing Rod';
    
    const growMatch = name.match(/Grow\\s+([A-Za-z\\s]+)\\s+\\d+\\s+times/i);
    if (growMatch) return growMatch[1].trim();
    
    return itemType || name;
  };
`;

code = code.replace(/const getChoreImage = \(name, itemType\) => \{/, tooltipKeyFunc + '\n  const getChoreImage = (name, itemType) => {');

// Replace getChoreImage with getTooltipKey for Tooltips and classNames
// We do this by replacing all instances of getChoreImage with getTooltipKey, EXCEPT for the img src and alt
code = code.replace(/flowerRecipes\[getChoreImage/g, 'flowerRecipes[getTooltipKey');
code = code.replace(/fishingRecipes\[getChoreImage/g, 'fishingRecipes[getTooltipKey');
code = code.replace(/fishData\[getChoreImage/g, 'fishData[getTooltipKey');
code = code.replace(/foodRecipes\[getChoreImage/g, 'foodRecipes[getTooltipKey');
code = code.replace(/dollRecipes\[getChoreImage/g, 'dollRecipes[getTooltipKey');
code = code.replace(/cropRecipes\[getChoreImage/g, 'cropRecipes[getTooltipKey');
code = code.replace(/\.includes\(getChoreImage/g, '.includes(getTooltipKey');

code = code.replace(/<CropTooltip cropName=\{getChoreImage/g, '<CropTooltip cropName={getTooltipKey');
code = code.replace(/<FlowerTooltip flowerName=\{getChoreImage/g, '<FlowerTooltip flowerName={getTooltipKey');
code = code.replace(/<FoodTooltip foodName=\{getChoreImage/g, '<FoodTooltip foodName={getTooltipKey');
code = code.replace(/<FishingTooltip itemName=\{getChoreImage/g, '<FishingTooltip itemName={getTooltipKey');
code = code.replace(/<FishTooltip itemName=\{getChoreImage/g, '<FishTooltip itemName={getTooltipKey');
code = code.replace(/<DollTooltip dollName=\{getChoreImage/g, '<DollTooltip dollName={getTooltipKey');
code = code.replace(/<ToolTooltip toolName=\{getChoreImage/g, '<ToolTooltip toolName={getTooltipKey');

fs.writeFileSync('src/components/ChoresPanel.jsx', code);
console.log('Fixed ChoresPanel tooltip keys');
