const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'crafting.devtools'), 'utf8');
const $ = cheerio.load(html);

const dollRecipes = {};

// We want to find the section containing Dolls.
// In the HTML we have <div class="ta-center bg-gray ...">Dolls</div>
// Then a bunch of div with float-start...
const dollsSection = $('div.b:contains("Angler Doll")').closest('.row').parent();

dollsSection.find('.float-start').each((i, el) => {
    const name = $(el).find('.b').first().text().trim();
    if (!name.includes('Doll')) return; // Just to be safe, filter by Doll

    // The grid is in the second table: <table class="p-1 m-auto">
    const gridTable = $(el).find('table.p-1.m-auto');
    if (!gridTable.length) return;

    const grid = [];
    gridTable.find('tr').each((r, tr) => {
        $(tr).find('td').each((c, td) => {
            const img = $(td).find('img');
            if (img.length) {
                // The title attribute contains the item name
                grid.push(img.attr('title') || null);
            } else {
                grid.push(null);
            }
        });
    });

    if (grid.length === 9) {
        dollRecipes[name] = grid;
    }
});

const outPath = path.join(__dirname, 'src', 'data', 'dollRecipes.json');
fs.writeFileSync(outPath, JSON.stringify(dollRecipes, null, 2));
console.log('Successfully wrote doll recipes to', outPath);
