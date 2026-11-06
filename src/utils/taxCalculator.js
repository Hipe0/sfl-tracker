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
  "Goblin Emblem": 200, "Sunflorian Emblem": 200, "Bumpkin Emblem": 200, "Nightshade Emblem": 200,
  // Thêm theo source game (src/features/game/actions/tradeLimits.ts, đối chiếu 2026-11-06)
  "Crystal Leaf": 500, "Green Beetle": 100, "Blue Beetle": 100, "Pink Beetle": 100, "Amber Beetle": 100,
  "Pig Bristles": 100, Truffle: 100
};

// Số lượng tối thiểu trong 1 đơn list (TRADE_MINIMUMS của game, src/features/game/actions/tradeLimits.ts)
const TRADE_MINIMUMS = {
  Sunflower: 200, Potato: 200, Rhubarb: 200, Pumpkin: 100, Zucchini: 100, Carrot: 100, Yam: 100, Cabbage: 100,
  Broccoli: 100, Soybean: 50, Beetroot: 50, Pepper: 50, Cauliflower: 50, Parsnip: 20, Eggplant: 20, Corn: 20,
  Onion: 20, Radish: 10, Wheat: 10, Turnip: 10, Kale: 10, Artichoke: 10, Barley: 10, Saltwort: 10,
  "Crystal Leaf": 10, Tomato: 20, Lemon: 10, Blueberry: 10, Orange: 10, Apple: 5, Banana: 5, Celestine: 3,
  Lunara: 2, Duskberry: 1, Grape: 5, Rice: 5, Olive: 5, Wood: 50, Stone: 10, Iron: 5, Gold: 3, Crimstone: 1,
  Salt: 10, Honey: 5, Feather: 20, Egg: 10, Milk: 5, Leather: 5, Wool: 10, "Merino Wool": 5, Ruffroot: 1,
  "Chewed Bone": 1, "Heart leaf": 1, "Frost Pebble": 1, "Wild Grass": 1, Ribbon: 1, Dewberry: 1, Moonfur: 1,
  "Capsule Bait": 1, "Umbrella Bait": 1, "Crimson Baitfish": 1, "Goblin Emblem": 1, "Sunflorian Emblem": 1,
  "Bumpkin Emblem": 1, "Nightshade Emblem": 1, "Green Beetle": 5, "Blue Beetle": 5, "Pink Beetle": 5,
  "Amber Beetle": 5, "Pig Bristles": 5, Truffle: 5
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

/**
 * Số lượng tối đa trong 1 đơn list trên chợ (TRADE_LIMITS của game), không phải tài nguyên thì null
 * @param {string} itemName
 * @returns {number|null}
 */
export function getTradeLimit(itemName) {
  return TRADE_LIMITS[itemName] ?? null;
}

/**
 * Số lượng tối thiểu trong 1 đơn list, không phải tài nguyên thì null
 * @param {string} itemName
 * @returns {number|null}
 */
export function getTradeMinimum(itemName) {
  return TRADE_MINIMUMS[itemName] ?? null;
}

/**
 * Danh sách tên mọi Tài nguyên (Resource), dùng cho ô chọn mặt hàng của bảng FLIP
 * @returns {string[]}
 */
export function getTradeResourceNames() {
  return Object.keys(TRADE_LIMITS);
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
