const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

const target = `                  // Extract Level from name like 'Level 5 Cow'
                  const levelMatch = req.name.match(/Level\\s+(\\d+)/i);
                  const level = levelMatch ? \`Lv \${levelMatch[1]}\` : 'Lv ?';`;

const targetN = `                  // Extract Level from name like 'Level 5 Cow'
                  const levelMatch = req.name.match(/Level\\s+(\\d+)/i);
                  const level = levelMatch ? \`Lv \${levelMatch[1]}\` : 'Lv ?';`.replace(/\r\n/g, '\n');

const replacement = `                  // Extract Level from req.level API property
                  const level = req.level ? \`Lv \${req.level}\` : 'Lv ?';`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
    console.log('Fixed animal level extraction');
} else if (code.replace(/\r\n/g, '\n').includes(targetN)) {
    code = code.replace(/\r\n/g, '\n').replace(targetN, replacement);
    fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
    console.log('Fixed animal level extraction (normalized)');
} else {
    console.log('Target not found!');
}
