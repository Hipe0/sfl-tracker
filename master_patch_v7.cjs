const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8');

const animalsBlockTarget = `                  if (rewardType === 'Shiny Feather') {
                      if (inventory.hasHat && inventory.hasArmor && inventory.hasPants) {
                          reward += 3;
                      }
                      animals.push({ animalName, level, reward, rewardType, status });
                  }`;

const animalsBlockReplacement = `                  if (rewardType === 'Shiny Feather') {
                      let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                      reward += ticketClothesBuff;
                      animals.push({ animalName, level, reward, rewardType, status });
                  }`;

if (code.includes(animalsBlockTarget)) {
    code = code.replace(animalsBlockTarget, animalsBlockReplacement);
    console.log("Reverted Animals Ticket Buff to +1 per item in farmRoutes.cjs");
} else {
    console.log("Animals block target not found! Normalizing newlines just in case.");
    code = code.replace(/\\r\\n/g, '\\n');
    const animalsBlockTargetN = animalsBlockTarget.replace(/\\r\\n/g, '\\n');
    const animalsBlockReplacementN = animalsBlockReplacement.replace(/\\r\\n/g, '\\n');
    
    if (code.includes(animalsBlockTargetN)) {
        code = code.replace(animalsBlockTargetN, animalsBlockReplacementN);
        console.log("Reverted Animals Ticket Buff to +1 per item in farmRoutes.cjs (with \n)");
    } else {
        console.log("Still not found!");
    }
}

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
