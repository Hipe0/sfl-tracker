/**
 * Tầng gọi API Sunflower Land (community). Chỉ lấy dữ liệu thô, không đụng DB.
 * Mọi request đi qua sflCommunityQueue để không vượt rate limit (~1 request / 5 giây mỗi IP).
 */
const https = require('https');
const zlib = require('zlib');
const readline = require('readline');
const { sflCommunityQueue } = require('../utils/apiQueue.cjs');

const BASE = 'https://api.sunflower-land.com';
const CDN = 'https://community.sunflower-land.com';
const RATE_LIMIT_RETRY_MS = 12000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function serverKey() {
  const key = process.env.SFL_API_KEY;
  if (!key) throw new Error('Thiếu SFL_API_KEY trong .env');
  return key;
}

async function getJson(path, { priority = false, apiKey = serverKey() } = {}) {
  const call = () => sflCommunityQueue.add(() => fetch(`${BASE}${path}`, { headers: { 'x-api-key': apiKey } }), priority);
  let res = await call();
  if (res.status === 429) {
    await sleep(RATE_LIMIT_RETRY_MS);
    res = await call();
  }
  if (!res.ok) {
    const err = new Error(`SFL API ${res.status} (${path.split('&')[0]})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Báo cáo chợ theo ngày (date = 'YYYY-MM-DD' UTC, bỏ trống = báo cáo đang chạy của hôm nay)
 * @returns {{ date: string|null, flowerPrice: number, totals: object, items: object }}
 */
async function getMarketplaceActivity(date, options) {
  const json = await getJson(`/community/data?type=marketplaceActivity${date ? `&date=${date}` : ''}`, options);
  const reports = json?.data?.reports || {};
  const day = Object.keys(reports).sort().pop() || null;
  return {
    date: day,
    flowerPrice: json?.data?.flowerPrice || 0,
    totals: day ? reports[day].totals || {} : {},
    items: day ? reports[day].items || {} : {}
  };
}

/** Danh sách file nightly dump còn trên CDN (7 ngày gần nhất) */
async function getNightlyDumpManifest(options) {
  const json = await getJson('/community/data?type=nightlyDump', options);
  return Array.isArray(json?.data) ? json.data : [];
}

/**
 * Đọc từng dòng (mỗi dòng 1 farm) của file nightly dump trên CDN, giải nén khi đang tải,
 * không giữ cả file trong bộ nhớ. onFarm(obj) được gọi cho mỗi dòng.
 */
function streamNightlyDump(filename, onFarm) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${CDN}/${filename}`, res => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`CDN ${res.statusCode} (${filename})`));
        return;
      }
      const gunzip = zlib.createGunzip();
      gunzip.on('error', reject);
      const rl = readline.createInterface({ input: res.pipe(gunzip), crlfDelay: Infinity });
      let lines = 0;
      rl.on('line', line => {
        if (!line) return;
        lines++;
        try {
          onFarm(JSON.parse(line));
        } catch { /* dòng hỏng thì bỏ qua */ }
      });
      rl.on('close', () => resolve({ lines }));
    });
    req.on('error', reject);
  });
}

module.exports = { getMarketplaceActivity, getNightlyDumpManifest, streamNightlyDump };
