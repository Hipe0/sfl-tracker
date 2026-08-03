const craftingCosts = {
  'Apple Juice': 1.5,
  'Apple': 0.5,
  'Carrot Cake': 3.2,
  'Orange Juice': 2.1
};

const chores = [
  { name: 'Cook Carrot Cake 7 times', total: 7 },
  { name: 'Drink 55 Orange Juice', total: 55 },
  { name: 'Harvest Carrots 200 times', total: 200 }
];

const keys = Object.keys(craftingCosts).sort((a, b) => b.length - a.length);

chores.forEach(chore => {
  const found = keys.find(k => chore.name.includes(k));
  if (found) {
    chore.itemType = found;
    chore.unitCost = craftingCosts[found];
    chore.choreCost = Number((craftingCosts[found] * chore.total).toFixed(4));
  }
});

console.log(chores);
