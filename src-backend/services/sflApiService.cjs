const { sflCommunityQueue, sflWorldQueue } = require('../utils/apiQueue.cjs');
const NodeCache = require('node-cache');

// Khởi tạo cache (TTL = 180 giây = 3 phút, kiểm tra rác mỗi 300 giây)
const farmCache = new NodeCache({ stdTTL: 180, checkperiod: 300 });

/**
 * Lấy GameData từ cộng đồng SFL, có sử dụng In-Memory Cache
 * @param {string} farmId ID của farm
 * @returns {Promise<Object>} gameData
 */
async function getGameData(farmId) {
  const cacheKey = `gameData_${farmId}`;
  
  // 1. Kiểm tra Cache
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  // 2. Nếu không có cache, gọi API thật qua Queue
  const apiKey = process.env.SFL_API_KEY;
  const communityRes = await sflCommunityQueue.add(() => 
    fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
      headers: { 'x-api-key': apiKey }
    })
  );
  
  if (communityRes.status === 429) {
    throw new Error("Lỗi: SFL API bị quá tải (Rate Limit). Vui lòng thử lại sau!");
  }
  
  if (!communityRes.ok) {
    throw new Error(`Lỗi kết nối SFL API (Mã lỗi: ${communityRes.status}). Vui lòng thử lại sau.`);
  }
  
  const resData = await communityRes.json();
  if (!resData || !resData.farm) {
    throw new Error("API trả về dữ liệu không hợp lệ hoặc nông trại không tồn tại.");
  }
  
  // 3. Lưu vào Cache
  farmCache.set(cacheKey, resData.farm);
  
  return resData.farm;
}

/**
 * Lấy Giá thị trường từ sfl.world, có sử dụng Cache
 * @returns {Promise<Object>} marketPrices
 */
async function getMarketPrices() {
  const cacheKey = `marketPrices`;
  
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  const pricesRes = await sflWorldQueue.add(() => fetch('https://sfl.world/api/v1/prices'));
  
  if (pricesRes.status === 429) {
    throw new Error("API sfl.world đang bị quá tải (Rate Limit). Vui lòng đợi 1 phút và thử lại!");
  }
  
  if (!pricesRes.ok) {
    throw new Error("Lỗi từ sfl.world API: " + pricesRes.statusText);
  }
  
  const priceData = await pricesRes.json();
  const prices = priceData?.data?.p2p || {};
  
  // Cache giá thị trường trong 3 phút
  farmCache.set(cacheKey, prices);
  
  return prices;
}

/**
 * Fetch Public Data (/visit) with Cache
 */
async function getPublicData(farmId) {
  const cacheKey = `publicData_${farmId}`;
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) return cachedData;
  
  const sflRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/visit/${farmId}`));
  if (!sflRes.ok) return null;
  
  const publicData = await sflRes.json();
  farmCache.set(cacheKey, publicData);
  return publicData;
}

/**
 * Trigger sfl.world cache update
 */
async function triggerSflWorldUpdate(farmId) {
  const cacheKey = `updateTriggered_${farmId}`;
  if (farmCache.get(cacheKey)) return; // Only trigger once every 3 mins
  
  try {
    const updateRes = await sflWorldQueue.add(() => fetch(`https://sfl.world/update/${farmId}`, { timeout: 5000 }));
    if (updateRes.ok) {
      await updateRes.json();
      farmCache.set(cacheKey, true);
    }
  } catch (e) {
    // Ignore error
  }
}

module.exports = {
  getGameData,
  getMarketPrices,
  getPublicData,
  triggerSflWorldUpdate,
  farmCache // Export để tiện xoá cache manual nếu cần
};
