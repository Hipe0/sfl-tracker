require('dotenv').config();
const jwt = require('jsonwebtoken');

async function run() {
  const token = jwt.sign({ id: '6279470157500012' }, process.env.JWT_SECRET || 'sfl-tracker-secret', { expiresIn: '1h' });
  const r = await fetch('http://localhost:3001/api/farm/6279470157500012?force=true', {headers: {'Authorization': 'Bearer ' + token}});
  let d = await r.json();
  console.log('HISTORY 1:', d.history.vip_gift, 'baseline:', d.history.baseline_daily_reward);
  
  const r2 = await fetch('http://localhost:3001/api/farm/6279470157500012?force=true', {headers: {'Authorization': 'Bearer ' + token}});
  let d2 = await r2.json();
  console.log('HISTORY 2:', d2.history.vip_gift, 'baseline:', d2.history.baseline_daily_reward);
  
  const r3 = await fetch('http://localhost:3001/api/farm/6279470157500012?force=true', {headers: {'Authorization': 'Bearer ' + token}});
  let d3 = await r3.json();
  console.log('HISTORY 3:', d3.history.vip_gift, 'baseline:', d3.history.baseline_daily_reward);
}
run();
