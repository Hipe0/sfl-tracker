/**
 * Nhóm tài nguyên trên chợ (hàm thuần). Danh sách tài nguyên lấy từ TRADE_LIMITS
 * trong src/utils/taxCalculator.js; ở đây chỉ chia nhóm để lọc trên giao diện.
 */

const CATEGORIES = [
  { id: 'crop', label: 'Cây trồng', items: ['Sunflower', 'Potato', 'Rhubarb', 'Pumpkin', 'Zucchini', 'Carrot', 'Yam', 'Cabbage', 'Broccoli', 'Soybean', 'Beetroot', 'Pepper', 'Cauliflower', 'Parsnip', 'Eggplant', 'Corn', 'Onion', 'Radish', 'Wheat', 'Turnip', 'Kale', 'Artichoke', 'Barley', 'Saltwort'] },
  { id: 'fruit', label: 'Trái cây', items: ['Tomato', 'Lemon', 'Blueberry', 'Orange', 'Apple', 'Banana'] },
  { id: 'greenhouse', label: 'Nhà kính', items: ['Grape', 'Rice', 'Olive'] },
  { id: 'special', label: 'Trái đặc biệt', items: ['Celestine', 'Lunara', 'Duskberry'] },
  { id: 'mineral', label: 'Khoáng sản', items: ['Wood', 'Stone', 'Iron', 'Gold', 'Crimstone', 'Salt'] },
  { id: 'animal', label: 'Động vật', items: ['Egg', 'Feather', 'Honey', 'Milk', 'Leather', 'Wool', 'Merino Wool'] },
  { id: 'pet', label: 'Đồ cho thú cưng', items: ['Ruffroot', 'Chewed Bone', 'Heart leaf', 'Frost Pebble', 'Wild Grass', 'Ribbon', 'Dewberry', 'Moonfur'] },
  { id: 'bait', label: 'Mồi câu', items: ['Capsule Bait', 'Umbrella Bait', 'Crimson Baitfish'] },
  { id: 'emblem', label: 'Huy hiệu phe', items: ['Goblin Emblem', 'Sunflorian Emblem', 'Bumpkin Emblem', 'Nightshade Emblem'] }
];

const categoryByItem = new Map();
for (const c of CATEGORIES) for (const item of c.items) categoryByItem.set(item, c.id);

function categoryOf(item) {
  return categoryByItem.get(item) || 'other';
}

module.exports = { CATEGORIES, categoryOf };
