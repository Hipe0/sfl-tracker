const { sflCommunityQueue, sflWorldQueue, smAuctionQueue } = require('../utils/apiQueue.cjs');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

const SM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://sunflowermanager.xyz/'
};

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
async function getGameData(farmId) {
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
  );
  
  if (communityRes.status === 429) {
    console.warn(`[Rate Limit] Bị chặn bởi SFL API. Đợi 3 giây rồi thử lại farm ${farmId}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    communityRes = await sflCommunityQueue.add(() => 
      fetch(`https://api.sunflower-land.com/community/farms/${farmId}`, {
        headers: { 'x-api-key': apiKey }
      })
    );
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
  
  let sflRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/visit/${farmId}`));
  
  if (sflRes.status === 429) {
    console.warn(`[Rate Limit] Bị chặn bởi SFL Visit API. Đợi 3 giây rồi thử lại farm ${farmId}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    sflRes = await sflCommunityQueue.add(() => fetch(`https://api.sunflower-land.com/visit/${farmId}`));
  }
  
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

/**
 * Fetch danh sách đấu giá từ Sunflower Manager
 */
async function fetchAuctionsList() {
  const cacheKey = `sm_auctions_list`;
  const cachedData = farmCache.get(cacheKey);
  if (cachedData) return cachedData;

  const res = await smAuctionQueue.add(() => fetch(`https://sunflowermanager.xyz/auctions`, { headers: SM_HEADERS }), true);
  if (!res.ok) throw new Error("Lỗi khi tải danh sách đấu giá từ SM");

  const data = await res.json();
  
  // Chuẩn hoá dữ liệu bổ sung curKey và curImg cho các phiên cũ
  if (data && Array.isArray(data.auctions)) {
    data.auctions = data.auctions.map(auc => {
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
 * Fetch chi tiết Leaderboard đấu giá từ Sunflower Manager
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

  const url = `https://sunflowermanager.xyz/getauction?auctionId=${encodeURIComponent(auctionId)}&farmId=${encodeURIComponent(farmId)}&username=${encodeURIComponent(username)}`;
  const res = await smAuctionQueue.add(() => fetch(url, { headers: SM_HEADERS }), priority);
  
  if (!res.ok) {
    if (res.status === 500 || res.status === 404) {
      throw new Error("Phiên đấu giá này quá cũ và SM không còn lưu trữ chi tiết.");
    }
    throw new Error(`Lỗi khi tải chi tiết đấu giá từ SM (${res.status})`);
  }

  const data = await res.json();
  
  // 3. Nếu phiên đấu giá đã kết thúc và lấy thành công, lưu vĩnh viễn
  if (data && data.endAt && data.endAt < Date.now()) {
    // Chốt giá USD vĩnh viễn
    if (data.leaderboard && data.leaderboard.length > 0) {
      let flowerUsdPrice = 0;
      try {
        const geckoRes = await fetch('https://api.geckoterminal.com/api/v2/networks/base/pools/0xafe30319a948f322585fafc1cab1671a47eb3786');
        if (geckoRes.ok) {
          const geckoData = await geckoRes.json();
          flowerUsdPrice = Number(geckoData?.data?.attributes?.base_token_price_usd) || 0;
        }
      } catch (e) {}

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
    let flowerUsdPrice = 0;
    try {
      const geckoRes = await fetch('https://api.geckoterminal.com/api/v2/networks/base/pools/0xafe30319a948f322585fafc1cab1671a47eb3786');
      if (geckoRes.ok) {
        const geckoData = await geckoRes.json();
        flowerUsdPrice = Number(geckoData?.data?.attributes?.base_token_price_usd) || 0;
      }
    } catch (e) {}
    
    // Đẩy vào queue (ưu tiên thấp - false)
    for (const auc of toSync) {
      try {
        const url = `https://sunflowermanager.xyz/getauction?auctionId=${encodeURIComponent(auc.auctionId)}&farmId=sync&username=sync`;
        const res = await smAuctionQueue.add(() => fetch(url, { headers: SM_HEADERS }), false);
        
        if (res.ok) {
           const detail = await res.json();
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
  getPublicData,
  triggerSflWorldUpdate,
  fetchAuctionsList,
  fetchAuctionDetails,
  startBackgroundAuctionSync,
  farmCache // Export để tiện xoá cache manual nếu cần
};
