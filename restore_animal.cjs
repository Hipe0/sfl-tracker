const fs = require('fs');
let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

// Remove HTML scraping for Animals
const animalsStart = code.indexOf('// 5. Animals');
if (animalsStart > -1) {
  const nextSection = code.indexOf('}', code.indexOf('animals.push', animalsStart)) + 5;
  code = code.substring(0, animalsStart) + code.substring(nextSection);
}

// Add API-based Animals parsing before 'res.json'
const apiAnimalCode = `
    // API-Based Animals (Shiny Feather Only)
    const animalNames = ['chicken', 'cow', 'sheep'];
    const completedBounties = (gameData && gameData.bounties && gameData.bounties.completed) ? gameData.bounties.completed.map(c => c.id) : [];
    const ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
    
    // Clear old animals array just in case
    animals = [];
    if (gameData && gameData.bounties && gameData.bounties.requests) {
        for (const req of gameData.bounties.requests) {
            const nameLower = (req.name || '').toLowerCase();
            const isAnimal = animalNames.some(a => nameLower.includes(a));
            
            if (isAnimal) {
                let rewardType = 'Unknown';
                let rewardAmount = 0;
                
                if (req.items) {
                    rewardType = Object.keys(req.items)[0];
                    rewardAmount = req.items[rewardType];
                }
                
                if (rewardType === 'Shiny Feather') {
                    rewardAmount += ticketClothesBuff;
                    const isCompleted = completedBounties.includes(req.id);
                    animals.push({
                        name: req.name,
                        animalName: req.name,
                        level: req.level ? \`Lvl \${req.level}+\` : 'Lvl 1+',
                        reward: rewardAmount,
                        rewardType: rewardType,
                        status: isCompleted ? 'claimed' : 'not_ready',
                        total: 1,
                        completed: isCompleted ? 1 : 0
                    });
                }
            }
        }
    }
`;

const resJsonStart = code.indexOf('res.json({');
code = code.substring(0, resJsonStart) + apiAnimalCode + '\n    ' + code.substring(resJsonStart);

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
