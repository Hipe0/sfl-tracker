const fs = require('fs');

let code = fs.readFileSync('src-backend/routes/farmRoutes.cjs', 'utf-8').replace(/\r\n/g, '\n');

// 1. Fix Bounties Reward Issue
const bountiesTarget = `                 const selectedReq = matchingReq || bReqs[0];
                 if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    rewardType = Object.keys(selectedReq.items)[0];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
                 }`;
const bountiesReplacement = `                 const selectedReq = matchingReq || bReqs[0];
                 if (selectedReq.items && Object.keys(selectedReq.items).length > 0) {
                    rewardType = Object.keys(selectedReq.items)[0];
                    reward = selectedReq.items[rewardType];
                 } else if (selectedReq.coins > 0) {
                    rewardType = 'Coins';
                    reward = selectedReq.coins;
                 }`;

if (code.includes(bountiesTarget)) {
    code = code.replace(bountiesTarget, bountiesReplacement);
    console.log("Fixed Bounties API Reward Amount Override");
}

// 2. Fix Animals Missing Issue
// The animals HTML is empty on sfl.world, so we build it entirely from API
const animalsBlockTarget = `      // 5. Animals
      if (titleText.includes('Animals')) {
        body.find('.w75').each((j, taskEl) => {
          const level = $c(taskEl).find('.w100p').text().trim();
          const imgSrc = $c(taskEl).find('img').first().attr('src');
          let animalName = '';
          if (imgSrc) {
            const match = imgSrc.match(/animals\\/(.+)\\.png/);
            if (match) animalName = match[1];
          }
          
          const rewardText = $c(taskEl).find('.m-top-5').text().trim();
          const reward = parseInt(rewardText.replace(/[^0-9]/g, '')) || 0;
          
          let status = 'not_ready';
          if ($c(taskEl).hasClass('text-bg-success')) status = 'claimed';
          else if ($c(taskEl).hasClass('text-bg-danger')) status = 'ready';
          
          let rewardType = 'Coins';
          
          if (gameData && gameData.bounties) {
              const completedBounties = gameData.bounties.completed || [];
              const bReqs = (gameData.bounties.requests || []).filter(r => r.name.toLowerCase().includes(animalName.toLowerCase()));
              let req = null;
              if (bReqs.length > 0) {
                 req = bReqs.find(r => {
                    if (r.coins && r.coins === reward) return true;
                    if (r.items) {
                       const itemAmount = Object.values(r.items)[0];
                       if (itemAmount === reward) return true;
                    }
                    return false;
                 }) || bReqs[0];
              }
              
              if (req) {
                 if (req.items && Object.keys(req.items).length > 0) {
                     rewardType = Object.keys(req.items)[0];
                     reward = req.items[rewardType];
                 } else if (req.coins > 0) {
                     rewardType = 'Coins';
                     reward = req.coins;
                 }
                 status = completedBounties.some(cb => cb.id === req.id) ? 'claimed' : status;
              }
          }
          
          if (rewardType === 'Shiny Feather') {
              let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
              reward += ticketClothesBuff;
          }
          
          if (animalName) {
            animals.push({ animalName, level, reward, rewardType, status });
          }
        });
      }`;

const animalsBlockReplacement = `      // 5. Animals
      if (titleText.includes('Animals')) {
          if (gameData && gameData.bounties && gameData.bounties.requests) {
              const completedBounties = gameData.bounties.completed || [];
              const aReqs = gameData.bounties.requests.filter(r => r.name.toLowerCase().includes('cow') || r.name.toLowerCase().includes('sheep') || r.name.toLowerCase().includes('chicken'));
              
              aReqs.forEach(req => {
                  let animalName = 'Unknown';
                  if (req.name.toLowerCase().includes('cow')) animalName = 'cow';
                  if (req.name.toLowerCase().includes('sheep')) animalName = 'sheep';
                  if (req.name.toLowerCase().includes('chicken')) animalName = 'chicken';
                  
                  // Extract Level from name like 'Level 5 Cow'
                  const levelMatch = req.name.match(/Level\\s+(\\d+)/i);
                  const level = levelMatch ? \`Lv \${levelMatch[1]}\` : 'Lv ?';
                  
                  let reward = 0;
                  let rewardType = 'Coins';
                  
                  if (req.items && Object.keys(req.items).length > 0) {
                     rewardType = Object.keys(req.items)[0];
                     reward = req.items[rewardType];
                  } else if (req.coins > 0) {
                     rewardType = 'Coins';
                     reward = req.coins;
                  }
                  
                  let status = completedBounties.some(cb => cb.id === req.id) ? 'claimed' : 'not_ready';
                  // if not claimed, how to know if 'ready'? API doesn't provide enough items count easily for animals, 
                  // but we can just leave it as not_ready or infer it if needed. Let's just default to not_ready.
                  
                  if (rewardType === 'Shiny Feather') {
                      let ticketClothesBuff = (inventory.hasHat ? 1 : 0) + (inventory.hasArmor ? 1 : 0) + (inventory.hasPants ? 1 : 0);
                      reward += ticketClothesBuff;
                  }
                  
                  animals.push({ animalName, level, reward, rewardType, status });
              });
          }
      }`;

if (code.includes(animalsBlockTarget)) {
    code = code.replace(animalsBlockTarget, animalsBlockReplacement);
    console.log("Fixed Animals API parsing entirely");
} else {
    console.log("Animals block target not found!");
}

fs.writeFileSync('src-backend/routes/farmRoutes.cjs', code);
console.log("Applied master_patch_v5.cjs");
