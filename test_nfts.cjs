require('dotenv').config();

async function checkNFTs() {
  const farmId = '6279470157500012';
  const res = await fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
    headers: { 'x-api-key': process.env.SFL_API_KEY }
  });
  const data = await res.json();
  const farm = data.farm;

  console.log("Inventory keys:", Object.keys(farm.inventory || {}));
  console.log("Wardrobe keys:", Object.keys(farm.wardrobe || {}));
  
  const checkList = [
    'Swamp Lily Hat', 
    'Swamp Armor', 
    'Swamp Pants', 
    'VIP Ticket',
    'Farmhand VIP',
    'Lifetime VIP'
  ];

  console.log("\nChecking Inventory:");
  checkList.forEach(item => {
    if (farm.inventory && farm.inventory[item]) {
      console.log(`Found ${item} in inventory: ${farm.inventory[item]}`);
    }
  });

  console.log("\nChecking Wardrobe:");
  checkList.forEach(item => {
    if (farm.wardrobe && farm.wardrobe[item]) {
      console.log(`Found ${item} in wardrobe: ${farm.wardrobe[item]}`);
    }
  });
}
checkNFTs();
