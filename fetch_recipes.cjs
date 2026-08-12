const fs = require('fs');

async function getRecipes() {
    try {
        const res = await fetch('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/consumables.ts');
        const text = await res.text();
        
        const recipes = {};
        const regex = /name:\s*\"([^\"]+)\"[\s\S]*?building:\s*\"([^\"]+)\"[\s\S]*?(?:cookingSeconds:\s*([^,]+),)[\s\S]*?ingredients:\s*\{([\s\S]*?)\}/g;
        
        let match;
        while ((match = regex.exec(text)) !== null) {
            const name = match[1];
            const building = match[2];
            const cookingSecondsRaw = match[3].replace(/\s/g, '');
            // evaluate simple math for cooking seconds like 60*60*2
            let cookingSeconds = 0;
            try { cookingSeconds = eval(cookingSecondsRaw); } catch(e) {}
            
            const ingredientsBlock = match[4];
            const ingredients = {};
            const ingRegex = /(?:\"([^\"]+)\"|([a-zA-Z0-9_]+)):\s*new\s+Decimal\(([^)]+)\)/g;
            let ingMatch;
            while ((ingMatch = ingRegex.exec(ingredientsBlock)) !== null) {
                const ingName = ingMatch[1] || ingMatch[2];
                const ingAmt = parseFloat(ingMatch[3]);
                ingredients[ingName] = ingAmt;
            }
            
            recipes[name] = {
                name,
                building,
                cookingSeconds,
                ingredients
            };
        }
        
        fs.writeFileSync('src/data/foodRecipes.json', JSON.stringify(recipes, null, 2));
        console.log('Saved ' + Object.keys(recipes).length + ' recipes to src/data/foodRecipes.json');
    } catch(e) {
        console.error(e);
    }
}
getRecipes();
