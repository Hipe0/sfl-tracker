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
    const daysToFetch = 90;
    
    console.log(`Bắt đầu tải dữ liệu Market của ${daysToFetch} ngày qua.`);
    console.log(`Tiến trình này sẽ lưu 4 mốc/ngày để vẽ râu nến (OHLC) và tính Volume Delta chuẩn. Mất ~8 phút...`);

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
            
            const lowPrices = {};
            const highPrices = {};
            const latestPrices = {};
            const openPrices = {};
            const currentVolume = {};
            const currentSupply = {};
            
            for (const [key, details] of Object.entries(items)) {
              const name = idMap[key];
              if (name) {
                const c = details.floor > 0 ? details.floor : 0;
                const o = prevLatestSale[name] || c;
                
                let h = details.high || c;
                let l = details.low || c;

                // Game API often returns wild outliers (e.g. high: 150 for a 0.01 crop due to multi-account trades).
                // We must clamp them so the candlestick chart doesn't get completely squished.
                if (c > 0) {
                  const maxBase = Math.max(o, c);
                  const minBase = Math.min(o, c);
                  const maxAllowed = maxBase * 1.5;
                  const minAllowed = minBase * 0.5;
                  
                  if (h > maxAllowed) h = maxAllowed;
                  if (l < minAllowed) l = minAllowed;
                }

                latestPrices[name] = c;
                openPrices[name] = o;
                lowPrices[name] = l;
                highPrices[name] = h;
                
                currentVolume[name] = details.volume || 0;
                currentSupply[name] = details.quantity || 0;
              }
            }
            
            // 4 mốc thời gian để vẽ 1 cây nến ngày chuẩn OHLC
            const t0 = new Date(`${dateStr}T00:00:01Z`).getTime();
            const t6 = new Date(`${dateStr}T06:00:00Z`).getTime();
            const t12 = new Date(`${dateStr}T12:00:00Z`).getTime();
            const t23 = new Date(`${dateStr}T23:59:59Z`).getTime();

            await collection.insertMany([
              { timestamp: t0, prices: openPrices, volumes: prevVolume, supplies: currentSupply },
              { timestamp: t6, prices: lowPrices, volumes: prevVolume, supplies: currentSupply },
              { timestamp: t12, prices: highPrices, volumes: currentVolume, supplies: currentSupply },
              { timestamp: t23, prices: latestPrices, volumes: currentVolume, supplies: currentSupply }
            ]);
            
            // Lưu lại cho ngày hôm sau
            prevLatestSale = latestPrices;
            prevVolume = currentVolume;
            
            console.log(` -> Đã tạo nến (Open, High, Low, Close) & Volume cho ${Object.keys(latestPrices).length} vật phẩm.`);
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
