const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf8');

code = code.replace(
  /const seedName = `\$\{singularName\} Seed`;/,
  `let seedName = \`\$\{singularName\} Seed\`;
              if (flowerRecipes[singularName]) {
                seedName = flowerRecipes[singularName].seed;
              }`
);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('Fixed seedName logic for flowers!');
