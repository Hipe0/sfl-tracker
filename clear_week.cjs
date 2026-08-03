const fs = require('fs');
const dbFile = 'database.json';

const db = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
const farmId = '6279470157500012';

if (db[farmId]) {
  const targetWeek = '2026-W32';
  
  // Clear chores
  if (db[farmId].chores && db[farmId].chores[targetWeek]) {
    delete db[farmId].chores[targetWeek];
  }

  // Clear bounties
  if (db[farmId].bounties_completed) {
    for (let key in db[farmId].bounties_completed) {
      if (db[farmId].bounties_completed[key].week === targetWeek) {
        delete db[farmId].bounties_completed[key];
      }
    }
  }

  // Clear animals
  if (db[farmId].animals_completed) {
    for (let key in db[farmId].animals_completed) {
      if (db[farmId].animals_completed[key].week === targetWeek) {
        delete db[farmId].animals_completed[key];
      }
    }
  }

  // Clear deliveries for this week's dates
  // 2026-W32 starts from Aug 3, 2026 to Aug 9, 2026
  if (db[farmId].deliveries) {
    for (let dateStr in db[farmId].deliveries) {
      if (dateStr >= '2026-08-03' && dateStr <= '2026-08-09') {
        delete db[farmId].deliveries[dateStr];
      }
    }
  }

  // Clear daily_chest for this week's dates
  if (db[farmId].daily_chest) {
    for (let dateStr in db[farmId].daily_chest) {
      if (dateStr >= '2026-08-03' && dateStr <= '2026-08-09') {
        delete db[farmId].daily_chest[dateStr];
      }
    }
  }

  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  console.log("Cleared database for week 2026-W32.");
} else {
  console.log("Farm ID not found in database.");
}
