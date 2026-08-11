const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const SEED_DAYS = {
    'Sunpetal Seed': 1,
    'Bloom Seed': 2,
    'Lily Seed': 5,
    'Edelweiss Seed': 1, // Need to verify if this is true
    'Gladiolus Seed': 1,
    'Lavender Seed': 1,
    'Clover Seed': 1
};

async function scrapeFlowers() {
  try {
    const res = await fetch('https://sfl.world/info/flowers');
    const data = await res.text();
    const $ = cheerio.load(data);
    const recipes = {};

    $('.mb-auto').each((i, container) => {
       const table = $(container).find('table.w175');
       if (!table.length) return;
       
       const flowerName = table.find('th').text().trim();
       if (!flowerName) return;
       
       const seedText = table.find('td.text-secondary').text();
       let seedMatch = seedText.match(/from\s*(.*?)\s*\+/);
       let seed = seedMatch ? seedMatch[1].trim() : 'Unknown Seed';
       if (seed === 'Sunpetal Seed') seed = 'Sunpetal Seed';
       else if (seed === 'Bloom Seed') seed = 'Bloom Seed';
       else if (seed === 'Lily Seed') seed = 'Lily Seed';
       
       const ingredients = [];
       const crops = [];
       table.find('tr').each((j, tr) => {
          const td = $(tr).find('td:not(.text-secondary)');
          if (td.length) {
             const rawText = td.text().trim();
             const text = rawText.replace(/^\(.*?\)/, '').trim();
             if (text) {
                 ingredients.push(text);
                 if (!rawText.match(/^\(\d+d\)/)) {
                     crops.push(text);
                 }
             }
          }
       });

       const bestRecipeChain = [];
       const alertDiv = $(container).find('div.alert-warning');
       if (alertDiv.length) {
           alertDiv.find('div:not(.m-left-25)').each((k, step) => {
               const text = $(step).text().trim();
               if (text) {
                   const cleanText = text.replace(/^\(.*?\)/, '').trim();
                   // Match (xd)
                   const match = text.match(/^\((\d+)d\)/);
                   const days = match ? parseInt(match[1]) : 0;
                   if (cleanText) {
                       bestRecipeChain.push({ name: cleanText, days: days });
                   }
               }
           });
       }

       recipes[flowerName] = { 
           seed, 
           baseDays: SEED_DAYS[seed] || 1,
           crossbreeds: ingredients,
           crops: crops,
           bestRecipeChain: bestRecipeChain.length > 0 ? bestRecipeChain : null
       };
    });
    
    // Fill in seeds for bestRecipeChain steps
    for (const [name, recipe] of Object.entries(recipes)) {
        if (recipe.bestRecipeChain) {
            recipe.bestRecipeChain.forEach(step => {
                const stepFlower = recipes[step.name];
                if (stepFlower) {
                    step.seed = stepFlower.seed;
                } else {
                    step.seed = 'Unknown Seed'; // In case it's a crop or missing
                }
            });
        }
    }

    const outPath = path.join(process.cwd(), 'src', 'data', 'flowerRecipes.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(recipes, null, 2));
    console.log('Saved recipes to ' + outPath);
  } catch (err) {
    console.error(err.message);
  }
}
scrapeFlowers();
