const fs = require('fs');

const lines = fs.readFileSync('server.cjs', 'utf8').split('\n');

const deliveriesStart = lines.findIndex(l => l.includes('if (isTicketReward) {'));
console.log('Deliveries logic:');
console.log(lines.slice(deliveriesStart - 10, deliveriesStart + 5).join('\n'));
