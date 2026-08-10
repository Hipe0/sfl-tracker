const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

const target = `              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              }
              if (itemName && total > 0) {`;

const replacement = `              let completed = 0, total = 0, enough = false;
              if (smallEl.length > 0 && bEl2.length > 0) {
                completed = parseInt(smallEl.text().replace(/[^0-9]/g, '')) || 0;
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                enough = completed >= total;
                if (!enough) allEnough = false;
              } else if ($c(bEl).find('.bi-check2-circle').length > 0) {
                total = parseInt(bEl2.text().replace(/[^0-9]/g, '')) || 0;
                if (total === 0) total = parseInt($c(bEl).text().replace(/[^0-9]/g, '')) || 0;
                completed = total;
                enough = true;
              }
              
              if (itemName && total > 0) {`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
    console.log("Successfully patched badge parsing in farmRoutes.cjs");
} else {
    console.log("Could not find target string in farmRoutes.cjs");
}
