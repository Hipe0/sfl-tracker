const fs = require('fs');
const data = JSON.parse(fs.readFileSync('api_response.json', 'utf8'));
const orders = data.data.gameData.delivery.orders;
console.log(JSON.stringify(orders[0], null, 2));
