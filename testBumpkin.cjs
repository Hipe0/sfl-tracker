require('dotenv').config();
const jwt = require('jsonwebtoken');

async function run() {
  const token = jwt.sign({ id: '6279470157500012' }, process.env.JWT_SECRET || 'sfl-tracker-secret', { expiresIn: '1h' });
  const r = await fetch('http://localhost:3001/api/farm/6279470157500012', {headers: {'Authorization': 'Bearer ' + token}});
  let d = await r.json();
  console.log(d.gameData?.bumpkin?.equipped);
}
run();
