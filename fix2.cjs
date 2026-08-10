const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

code = code.replace(/const itemName = \$c\(bEl\)\.find\('div'\)\.first\(\)\.text\(\)\.trim\(\);/g,
`const itemNameMatch = $c(bEl).text().trim().match(/^[a-zA-Z\\s'-]+/);
              const itemName = itemNameMatch ? itemNameMatch[0].trim() : ($c(bEl).find('div').first().text().trim());`);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log('itemNameMatch:', code.includes('itemNameMatch'));
