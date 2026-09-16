const { sflCommunityQueue, sflWorldQueue, smAuctionQueue } = require('../utils/apiQueue.cjs');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');



const historyFilePath = path.join(__dirname, '../data/auction_history.json');

if (!fs.existsSync(path.dirname(historyFilePath))) {
  fs.mkdirSync(path.dirname(historyFilePath), { recursive: true });
}

let auctionHistory = {};
try {
  if (fs.existsSync(historyFilePath)) {
    auctionHistory = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
  }
} catch (e) {
  console.error("Error loading auction history", e);
}

const saveHistory = () => {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(auctionHistory, null, 2));
  } catch (e) {
    console.error("Error saving auction history", e);
  }
};

// Khởi tạo cache (TTL = 180 giây = 3 phút, kiểm tra rác mỗi 300 giây)
const farmCache = new NodeCache({ stdTTL: 180, checkperiod: 300 });

/**
 * Lấy GameData từ cộng đồng SFL, có sử dụng In-Memory Cache
 * @param {string} farmId ID của farm
 * @returns {Promise<Object>} gameData
 */
async function getGameData(farmId, isPriority = false) {
  const cacheKey = `gameData_${farmId}`;
  
  // 1. Kiểm tra Cache
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  // 2. Nếu không có cache, gọi API thật qua Queue
  const apiKey = process.env.SFL_API_KEY;
  let communityRes = await sflCommunityQueue.add(() => 
    fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
      headers: { 'x-api-key': apiKey }
    })
  , isPriority);
  
  if (communityRes.status === 429) {
    console.warn(`[Rate Limit] Bị chặn bởi SFL API. Đợi 12 giây rồi thử lại farm ${farmId}...`);
    await new Promise(resolve => setTimeout(resolve, 12000));
    communityRes = await sflCommunityQueue.add(() => 
      fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
        headers: { 'x-api-key': apiKey }
      })
    , isPriority);
    if (communityRes.status === 429) {
      throw new Error("Lỗi: SFL API bị quá tải (Rate Limit). Vui lòng thử lại sau!");
    }
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
// Map dùng để dịch từ ID sang Tên vật phẩm
let idMapCache = null;
function loadIdMap() {
  if (idMapCache) return idMapCache;
  try {
    idMapCache = require('../../src/data/idMap.json');
  } catch (err) {
    console.error("Failed to load idMap.json", err);
    idMapCache = {};
  }
  return idMapCache;
}

async function getMarketPrices() {
  const cacheKey = `marketPrices_community`;
  
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  // Lấy dữ liệu từ Community API thay vì sfl.world
  const activityData = await fetchMarketplaceActivity();
  const items = activityData.items || {};
  
  const idMap = loadIdMap();
  const prices = {};
  const currentTraded = {};
  const currentListings = {};
  
  for (const [key, details] of Object.entries(items)) {
    // keys có dạng "collectibles-201" hoặc "wearables-1"
    const name = idMap[key];
    if (name) {
      // Ưu tiên dùng floor (giá đang treo rẻ nhất), nếu không có thì lấy latestSale
      const price = details.floor > 0 ? details.floor : (details.latestSale || 0);
      if (price > 0) {
        prices[name] = price;
        currentTraded[name] = details.quantity || 0;
        currentListings[name] = details.listingCount || 0;
      }
    }
  }
  
  const result = { prices, traded: currentTraded, listings: currentListings };
  
  // Cache giá thị trường trong 3 phút (180 giây)
  farmCache.set(cacheKey, result, 180);
  
  return result;
}

/**
 * Lấy dữ liệu giá, volume và tổng cung để lưu DB
 */
async function getMarketDataForDB() {
  const activityData = await fetchMarketplaceActivity();
  const items = activityData.items || {};
  
  const idMap = loadIdMap();
  const prices = {};
  const volumes = {};
  const supplies = {};
  const listings = {};
  
  for (const [key, details] of Object.entries(items)) {
    const name = idMap[key];
    if (name) {
      prices[name] = details.floor > 0 ? details.floor : 0;
      volumes[name] = details.volume || 0;
      
      supplies[name] = { active: 0, total: 0 };
      
      listings[name] = details.listingCount || 0;
    }
  }
  
  return { prices, volumes, supplies, listings };
}

/**
 * Fetch Public Data (/visit) with Cache
 */
async function getPublicData(farmId, isPriority = false) {
  const cacheKey = `publicData_${farmId}`;
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) return cachedData;
  
  let sflRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/visit/${farmId}`), isPriority);
  
  if (sflRes.status === 429) {
    console.warn(`[Rate Limit] Bị chặn bởi SFL Visit API. Đợi 12 giây rồi thử lại farm ${farmId}...`);
    await new Promise(resolve => setTimeout(resolve, 12000));
    sflRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/visit/${farmId}`), isPriority);
  }
  
  if (!sflRes.ok) return null;
  
  const publicData = await sflRes.json();
  farmCache.set(cacheKey, publicData);
  return publicData;
}

/**
 * Fetch Marketplace Activity (để lấy flowerPrice)
 */
async function fetchMarketplaceActivity() {
  const cacheKey = `community_marketplace_v2`;
  const cachedData = farmCache.get(cacheKey);
  if (cachedData !== undefined) return cachedData;

  const apiKey = process.env.SFL_API_KEY;
  try {
    const res = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/community/data?type=marketplaceActivity`, { headers: { 'x-api-key': apiKey } }));
    if (res.ok) {
      const data = await res.json();
      const flowerUsdPrice = data?.data?.flowerPrice || 0;
      
      let items = {};
      if (data?.data?.reports) {
        const dates = Object.keys(data.data.reports).sort((a, b) => new Date(b) - new Date(a));
        if (dates.length > 0) {
          items = data.data.reports[dates[0]].items || {};
        }
      }
      
      const result = { flowerUsdPrice, items };
      farmCache.set(cacheKey, result, 180); // 3 mins cache
      return result;
    }
  } catch (e) {
    console.error("Lỗi khi tải marketplaceActivity:", e.message);
  }
  return { flowerUsdPrice: 0, items: {} };
}

/**
 * Fetch Marketplace Profile (Trade History) for a specific farm
 */
async function fetchMarketplaceProfile(farmId, isPriority = true) {
  const cacheKey = `market_profile_${farmId}`;
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) return cachedData;

  const apiKey = process.env.SFL_API_KEY;
  try {
    let res = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/community/data?type=marketplaceProfile&farmId=${farmId}`, { headers: { 'x-api-key': apiKey } }), isPriority);
    
    if (res.status === 429) {
      console.warn(`[Rate Limit] Bị chặn khi fetch profile. Đợi 12s rồi thử lại farm ${farmId}...`);
      await new Promise(resolve => setTimeout(resolve, 12000));
      res = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/community/data?type=marketplaceProfile&farmId=${farmId}`, { headers: { 'x-api-key': apiKey } }), isPriority);
    }
    
    if (res.ok) {
      const data = await res.json();
      farmCache.set(cacheKey, data.data || {}, 180); // Cache for 3 minutes
      return data.data || {};
    }
    throw new Error(`Marketplace Profile API Error: ${res.status}`);
  } catch (e) {
    console.error(`Error fetching marketplaceProfile for farm ${farmId}:`, e.message);
    throw e;
  }
}

/**
 * Fetch danh sách đấu giá từ Community API
 */
async function fetchAuctionsList() {
  const cacheKey = `sm_auctions_list`;
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) return cachedData;

  const apiKey = process.env.SFL_API_KEY;
  const res = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/community/data?type=auctions`, { headers: { 'x-api-key': apiKey } }), true);
  if (!res.ok) throw new Error("Lỗi khi tải danh sách đấu giá từ Community API");

  const rawData = await res.json();
  const data = { auctions: rawData?.data?.auctions || [] };
  
  // Chuẩn hoá dữ liệu bổ sung curKey, curImg, và itemName cho các phiên cũ
  if (data && Array.isArray(data.auctions)) {
    data.auctions = data.auctions.map(auc => {
      auc.itemName = auc.itemName || auc.wearable || auc.collectible || 'Unknown Item';
      if (!auc.curKey) {
        if (auc.sfl > 0) {
          auc.curKey = 'Flower';
          auc.curImg = './icon/res/flowertoken.webp';
        } else if (auc.ingredients && Object.keys(auc.ingredients).length > 0) {
          const keys = Object.keys(auc.ingredients);
          auc.curKey = keys[0];
          if (auc.curKey === 'Gem' || auc.curKey.toLowerCase() === 'gem') {
             auc.curImg = './icon/res/gem.webp';
          } else if (auc.curKey === 'Shiny Feather' || auc.curKey.toLowerCase() === 'shiny feather') {
             auc.curImg = './icon/res/shiny_feather.webp';
          }
        } else {
          auc.curKey = 'Flower'; // Mặc định
          auc.curImg = './icon/res/flowertoken.webp';
        }
      }
      return auc;
    });
  }

  // Cache for 10 minutes
  farmCache.set(cacheKey, data, 600);
  return data;
}

/**
 * Fetch chi tiết Leaderboard đấu giá từ Community API
 */
async function fetchAuctionDetails(auctionId, farmId, username, priority = true) {
  // 1. Check permanent history first (siêu tốc, không có rate limit)
  if (auctionHistory[auctionId]) {
    return auctionHistory[auctionId];
  }

  // 2. Use a short cache (1 min) to prevent spamming for active auctions
  const cacheKey = `sm_auction_${auctionId}_${farmId}`;
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) return cachedData;

  const apiKey = process.env.SFL_API_KEY;
  const url = `https://api.sunflower-land.com/community/data?type=auctionResults&auctionId=${encodeURIComponent(auctionId)}`;
  const res = await sflCommunityQueue.add(() => fetch(url, { headers: { 'x-api-key': apiKey } }), priority);
  
  if (!res.ok) {
    if (res.status === 500 || res.status === 404) {
      throw new Error("Phiên đấu giá này quá cũ và API không còn lưu trữ chi tiết.");
    }
    throw new Error(`Lỗi khi tải chi tiết đấu giá từ Community API (${res.status})`);
  }

  const resJson = await res.json();
  const data = resJson.data || {};
  
  // 3. Nếu phiên đấu giá đã kết thúc và lấy thành công, lưu vĩnh viễn
  if (data && data.endAt && data.endAt < Date.now()) {
    // Chốt giá USD vĩnh viễn
    if (data.leaderboard && data.leaderboard.length > 0) {
      const { flowerUsdPrice } = await fetchMarketplaceActivity();

      const listRes = await fetchAuctionsList();
      const auctionInfo = (listRes?.auctions || []).find(a => a.auctionId === auctionId) || {};
      const curKey = auctionInfo.curKey || 'Flower';
      data.curKey = curKey;

      data.leaderboard = data.leaderboard.map(u => {
        if (curKey === 'Flower' || curKey === 'flowertoken') {
          u.usdcValue = Number(((u.sfl || 0) * flowerUsdPrice).toFixed(3));
        } else {
          u.usdcValue = null;
        }
        return u;
      });
    }

    auctionHistory[auctionId] = data;
    saveHistory();
  }
  
  farmCache.set(cacheKey, data, 60);
  return data;
}

let isSyncing = false;
async function startBackgroundAuctionSync() {
  if (isSyncing) return;
  isSyncing = true;
  
  try {
    const ascStart = new Date("2026-08-03T00:00:00.000Z").getTime();
    console.log("[SYNC] Bắt đầu đồng bộ ngầm các đợt đấu giá cũ của Chapter 15...");
    
    // Lấy danh sách full
    const data = await fetchAuctionsList();
    if (!data || !data.auctions) return;
    
    // Lọc: Chapter 15 (endAt >= ascStart), đã kết thúc (endAt < Date.now()), chưa có trong history
    const now = Date.now();
    const toSync = data.auctions.filter(a => {
      return a.endAt >= ascStart && a.endAt < now && !auctionHistory[a.auctionId];
    });
    
    console.log(`[SYNC] Tìm thấy ${toSync.length} đợt đấu giá cũ cần tải.`);
    
    // Lấy giá USD 1 lần duy nhất cho toàn bộ batch để tránh rate limit
    const { flowerUsdPrice } = await fetchMarketplaceActivity();
    
    const apiKey = process.env.SFL_API_KEY;

    // Đẩy vào queue (ưu tiên thấp - false)
    for (const auc of toSync) {
      try {
        const url = `https://api.sunflower-land.com/community/data?type=auctionResults&auctionId=${encodeURIComponent(auc.auctionId)}`;
        const res = await sflCommunityQueue.add(() => fetch(url, { headers: { 'x-api-key': apiKey } }), false);
        
        if (res.ok) {
           const resJson = await res.json();
           const detail = resJson.data || {};
           if (detail && detail.endAt && detail.endAt < Date.now()) {
              if (detail.leaderboard && detail.leaderboard.length > 0) {
                 const curKey = auc.curKey || 'Flower';
                 detail.curKey = curKey;
                 detail.leaderboard = detail.leaderboard.map(u => {
                    if (curKey === 'Flower' || curKey === 'flowertoken') {
                       u.usdcValue = Number(((u.sfl || 0) * flowerUsdPrice).toFixed(3));
                    } else {
                       u.usdcValue = null;
                    }
                    return u;
                 });
              }
              auctionHistory[auc.auctionId] = detail;
              saveHistory();
              console.log(`[SYNC] Đã lưu thành công: ${auc.auctionId}`);
           }
        } else {
           if (res.status === 404 || res.status === 500) {
              // Lưu lỗi để lần sau không gọi lại nữa
              auctionHistory[auc.auctionId] = { error: res.status, endAt: auc.endAt };
              saveHistory();
              console.log(`[SYNC] Phiên đã bị xóa/lỗi ở web gốc, bỏ qua vĩnh viễn: ${auc.auctionId}`);
           }
        }
      } catch (err) {
        console.error(`[SYNC] Lỗi khi tải ${auc.auctionId}:`, err.message);
      }
    }
    
    console.log("[SYNC] Đã hoàn thành đồng bộ ngầm!");
  } catch (err) {
    console.error("[SYNC] Lỗi trong quá trình đồng bộ:", err);
  } finally {
    isSyncing = false;
  }
}

module.exports = {
  getGameData,
  getMarketPrices,
  getMarketDataForDB,
  getPublicData,
  fetchMarketplaceActivity,
  fetchAuctionsList,
  fetchAuctionDetails,
  startBackgroundAuctionSync,
  fetchMarketplaceProfile,
  farmCache // Export để tiện xoá cache manual nếu cần
};

