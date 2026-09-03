// Danh sách các vật phẩm được coi là Resource (Tài nguyên) trong Sunflower Land
const TRADE_LIMITS = {
  Sunflower: 4000, Potato: 3000, Rhubarb: 2000, Pumpkin: 2000, Zucchini: 2000,
  Carrot: 2000, Yam: 2000, Cabbage: 2000, Broccoli: 2000, Soybean: 2000,
  Beetroot: 1000, Pepper: 1000, Cauliflower: 1000, Parsnip: 1000, Eggplant: 1000,
  Corn: 1000, Onion: 1000, Radish: 500, Wheat: 500, Turnip: 500, Kale: 500,
  Artichoke: 500, Barley: 500, Saltwort: 500, Tomato: 400, Lemon: 300,
  Blueberry: 300, Orange: 300, Apple: 200, Banana: 200, Celestine: 20,
  Lunara: 15, Duskberry: 10, Grape: 100, Rice: 100, Olive: 100,
  Wood: 500, Stone: 200, Iron: 200, Gold: 100, Crimstone: 20,
  Salt: 500, Egg: 500, Feather: 1000, Honey: 100, Milk: 100,
  Leather: 100, Wool: 1000, "Merino Wool": 400,
  Ruffroot: 100, "Chewed Bone": 100, "Heart leaf": 100, "Frost Pebble": 100,
  "Wild Grass": 100, Ribbon: 100, Dewberry: 100, Moonfur: 100,
  "Capsule Bait": 10, "Umbrella Bait": 10, "Crimson Baitfish": 10,
  "Goblin Emblem": 200, "Sunflorian Emblem": 200, "Bumpkin Emblem": 200, "Nightshade Emblem": 200
};

// Mức thuế cơ bản cho Resource dựa trên loại Đảo (Island Type)
const ISLAND_RESOURCE_TAXES = {
  basic: 1.0,     // 100%
  spring: 0.55,   // 55%
  desert: 0.25,   // 25%
  volcano: 0.15,  // 15%
  swamp: 0.15,
  spooky: 0.15,
  crystal: 0.15,
  galaxy: 0.15,
  marble: 0.15
};

/**
 * Kiểm tra xem vật phẩm có phải là Tài nguyên (Resource) không
 * @param {string} itemName Tên vật phẩm
 * @returns {boolean}
 */
export function isTradeResource(itemName) {
  return itemName in TRADE_LIMITS;
}

const MARKETPLACE_TAX = 0.1; // 10% cố định cho NFT

/**
 * Tính tỷ lệ thuế áp dụng cho lệnh bán.
 * Phân tách rõ thuế cho NFT và Thuế cho Tài nguyên (Resource).
 * 
 * @param {string} itemName Tên vật phẩm
 * @param {object} farmData Dữ liệu farm hiện tại (từ FarmContext)
 * @returns {number} Tỷ lệ thuế (ví dụ: 0.1, 0.15, 0.55)
 */
export function calculateTradeTax(itemName, farmData) {
  // 1. Nếu là NFT (không có trong danh sách Resource TRADE_LIMITS) -> Áp dụng 10% mặc định
  if (!isTradeResource(itemName)) {
    return MARKETPLACE_TAX;
  }

  // Lấy gameData từ farmData (vì farmData trả về từ backend bọc state thực tế trong gameData)
  const gameData = farmData?.gameData || farmData || {};

  // 2. Nếu là Resource -> Thuế phụ thuộc vào loại đảo
  let islandType = gameData?.island?.type || 'basic';
  let baseTax = ISLAND_RESOURCE_TAXES[islandType] !== undefined ? ISLAND_RESOURCE_TAXES[islandType] : 1.0;

  // 3. Giảm trừ nếu có VIP Access (Giảm 50% thuế)
  let hasVip = false;
  
  if (gameData?.inventory && gameData.inventory["Lifetime Farmer Banner"]) {
    hasVip = true;
  }
  
  if (gameData?.vip && gameData.vip.expiresAt) {
    if (gameData.vip.expiresAt > Date.now()) {
      hasVip = true;
    }
  }

  if (hasVip) {
    baseTax = baseTax * 0.5;
  }

  // 4. Giảm trừ nếu có Trading Shrine (Trừ 5%)
  if (gameData?.collectibles && gameData.collectibles["Trading Shrine"]) {
    if (gameData.collectibles["Trading Shrine"].length > 0) {
      baseTax = baseTax - 0.05;
    }
  }

  // Thuế tối thiểu là 0 (phòng trường hợp âm)
  return Math.max(0, baseTax);
}
