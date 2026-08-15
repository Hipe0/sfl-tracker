const fs = require('fs');

const crops = {
  "Sunflower": { harvestSeconds: 1 * 60, seed: "Sunflower Seed" },
  "Potato": { harvestSeconds: 5 * 60, seed: "Potato Seed" },
  "Pumpkin": { harvestSeconds: 30 * 60, seed: "Pumpkin Seed" },
  "Carrot": { harvestSeconds: 60 * 60, seed: "Carrot Seed" },
  "Cabbage": { harvestSeconds: 2 * 60 * 60, seed: "Cabbage Seed" },
  "Soybean": { harvestSeconds: 3 * 60 * 60, seed: "Soybean Seed" },
  "Beetroot": { harvestSeconds: 4 * 60 * 60, seed: "Beetroot Seed" },
  "Cauliflower": { harvestSeconds: 8 * 60 * 60, seed: "Cauliflower Seed" },
  "Parsnip": { harvestSeconds: 12 * 60 * 60, seed: "Parsnip Seed" },
  "Eggplant": { harvestSeconds: 16 * 60 * 60, seed: "Eggplant Seed" },
  "Corn": { harvestSeconds: 20 * 60 * 60, seed: "Corn Seed" },
  "Radish": { harvestSeconds: 24 * 60 * 60, seed: "Radish Seed" },
  "Wheat": { harvestSeconds: 24 * 60 * 60, seed: "Wheat Seed" },
  "Kale": { harvestSeconds: 36 * 60 * 60, seed: "Kale Seed" },
  
  "Tomato": { harvestSeconds: 120 * 60, seed: "Tomato Seed" },
  "Lemon": { harvestSeconds: 120 * 60, seed: "Lemon Seed" },
  "Blueberry": { harvestSeconds: 6 * 60 * 60, seed: "Blueberry Seed" },
  "Orange": { harvestSeconds: 8 * 60 * 60, seed: "Orange Seed" },
  "Apple": { harvestSeconds: 12 * 60 * 60, seed: "Apple Seed" },
  "Banana": { harvestSeconds: 14 * 60 * 60, seed: "Banana Plant" },
  
  "Barley": { harvestSeconds: 60, seed: "Barley Seed" },
  "Rhubarb": { harvestSeconds: 10 * 60, seed: "Rhubarb Seed" },
  "Zucchini": { harvestSeconds: 30 * 60, seed: "Zucchini Seed" },
  "Yam": { harvestSeconds: 60 * 60, seed: "Yam Seed" },
  "Broccoli": { harvestSeconds: 2 * 60 * 60, seed: "Broccoli Seed" },
  "Pepper": { harvestSeconds: 4 * 60 * 60, seed: "Pepper Seed" },
  "Onion": { harvestSeconds: 8 * 60 * 60, seed: "Onion Seed" },
  "Turnip": { harvestSeconds: 12 * 60 * 60, seed: "Turnip Seed" },
  "Artichoke": { harvestSeconds: 16 * 60 * 60, seed: "Artichoke Seed" },
  "Saltwort": { harvestSeconds: 24 * 60 * 60, seed: "Saltwort Seed" },
};

Object.keys(crops).forEach(k => {
    crops[k].baseDays = crops[k].harvestSeconds / 86400;
});

fs.writeFileSync('src/data/cropRecipes.json', JSON.stringify(crops, null, 2));
console.log('Saved');
