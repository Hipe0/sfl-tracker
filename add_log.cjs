const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

if (!code.includes('console.log(\'raw delivery badge text:\'')) {
    code = code.replace(/const itemNameMatch = \$c\(bEl\)\.text\(\)\.trim\(\)\.match\(\/\^\[a-zA-Z\\s'-\]\+\/\);/, 
        `const itemNameMatch = $c(bEl).text().trim().match(/^[a-zA-Z\\s'-]+/);
              console.log('raw delivery badge text:', $c(bEl).text().trim());
              console.log('raw delivery badge HTML:', $c(bEl).html());`);
    fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
    console.log('Added console.log');
}
