const { MongoClient } = require('mongodb');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function loadIdMap() {
  try {
    const filePath = path.join(__dirname, '../src/data/idMap.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Lỗi đọc idMap.json", err);
    return {};
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const apiKey = process.env.SFL_API_KEY;

  if (!uri || !apiKey) {
    console.error("Thiếu MONGODB_URI hoặc SFL_API_KEY trong file .env");
    return;
  }

  const idMap = loadIdMap();
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('sfl_tracker');
    const collection = db.collection('market_prices');

    // Xoá trắng dữ liệu lỗi cũ để làm lại cho chuẩn
    await collection.deleteMany({});
    console.log("Đã xoá sạch dữ liệu cũ để tiến hành cài lại dữ liệu OHLC chuẩn...");

    const now = new Date();
    const daysToFetch = 90; // Tải trọn vẹn 90 ngày lịch sử
    
    console.log(`Bắt đầu tải dữ liệu Market của ${daysToFetch} ngày qua.`);
    console.log(`Tiến trình này sẽ lưu 1 mốc/ngày. Mất khoảng 8-10 phút...`);

    let prevLatestSale = {};
    let prevVolume = {};

    // Phải lùi từ quá khứ tới hiện tại để volume cumulative tính toán đúng
    for (let i = daysToFetch - 1; i >= 0; i--) {
      const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = targetDate.toISOString().split('T')[0];
      
      console.log(`[${daysToFetch - i}/${daysToFetch}] Đang xử lý ngày ${dateStr}...`);
      
      try {
        const url = `https://api.sunflower-land.com/community/data?type=marketplaceActivity&date=${dateStr}`;
        const res = await fetch(url, { headers: { 'x-api-key': apiKey } });
        
        if (res.status === 429) {
          console.log(" -> Bị chặn Rate Limit! Nghỉ 10 giây...");
          await sleep(10000);
          i++; // Thử lại
          continue;
        }
        
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.reports?.[dateStr]) {
            const items = json.data.reports[dateStr].items || {};
            
            const prices = {};
            const volumes = {};
            const sales = {};
            const listings = {};
            
            for (const [key, details] of Object.entries(items)) {
              const name = idMap[key];
              if (name) {
                // Ưu tiên giá sàn (floor), nếu không có thì lấy giá giao dịch gần nhất
                prices[name] = details.floor > 0 ? details.floor : (details.latestSale || 0);
                volumes[name] = details.volume || 0;
                sales[name] = details.trades || 0;
                listings[name] = details.listingCount || 0;
                // KHÔNG lưu supplies vì API không có dữ liệu supply lịch sử, tránh lưu nhầm quantity vào supply
              }
            }
            
            // Chỉ lưu 1 mốc thời gian chốt ngày (23:59:59Z) để vẽ Line Chart chuẩn xác
            const t23 = new Date(`${dateStr}T23:59:59Z`).getTime();

            await collection.insertOne({ 
              timestamp: t23, 
              prices: prices, 
              volumes: volumes, 
              sales: sales,
              listings: listings
            });
            
            console.log(` -> Đã lưu Prices, Volume, Sales, Listings cho ${Object.keys(prices).length} vật phẩm.`);
          }
        }
      } catch (e) {
        console.error(` -> Lỗi mạng ngày ${dateStr}:`, e.message);
      }
      
      await sleep(5000);
    }
    
    console.log("\n==================================");
    console.log("🎉 ĐÃ TẢI XONG TOÀN BỘ 90 NGÀY LỊCH SỬ MARKET!");
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
