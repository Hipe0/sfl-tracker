/**
 * Dựng nến giá (OHLC) từ dữ liệu đã lưu trong DB (hàm thuần).
 */

const BUCKETS = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000
};

const utcDay = ts => new Date(ts).toISOString().slice(0, 10);

/**
 * Nến từ ảnh chụp 15 phút: points = [{ timestamp, price, volume, listings }] tăng dần theo thời gian.
 * volume trong ảnh chụp là volume LUỸ KẾ từ trước tới giờ (API trả số luỹ kế),
 * nên volume của nến = phần tăng giữa hai ảnh chụp liền nhau.
 */
function candlesFromSnapshots(points, granularity = '1h') {
  const size = BUCKETS[granularity] || BUCKETS['1h'];
  const out = [];
  let prevVolume = null;
  let current = null;
  for (const p of points) {
    if (!(p.price > 0)) continue;
    let volume = 0;
    if (p.volume != null) {
      volume = prevVolume != null && p.volume >= prevVolume ? p.volume - prevVolume : 0;
      prevVolume = p.volume;
    }
    const time = p.timestamp - (p.timestamp % size);
    if (!current || current.time !== time) {
      current = { time, open: p.price, high: p.price, low: p.price, close: p.price, volume: 0, listings: p.listings ?? null };
      out.push(current);
    }
    current.high = Math.max(current.high, p.price);
    current.low = Math.min(current.low, p.price);
    current.close = p.price;
    current.volume += volume;
    if (p.listings != null) current.listings = p.listings;
  }
  return out;
}

/**
 * Đổi số luỹ kế của từng ngày thành số trong ngày: volume/trades/quantity = hiệu với ngày liền trước.
 * Thiếu ngày liền trước thì để null (không đoán). rows của 1 tài nguyên, tăng dần theo ngày.
 */
function withDailyDiffs(rows) {
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    const consecutive = prev && Date.parse(`${r.date}T00:00:00Z`) - Date.parse(`${prev.date}T00:00:00Z`) === BUCKETS['1d'];
    const diff = key => (consecutive && r[key] != null && prev[key] != null && r[key] >= prev[key] ? r[key] - prev[key] : null);
    return { ...r, volume: diff('cumVolume'), trades: diff('cumTrades'), quantity: diff('cumQuantity') };
  });
}

/**
 * Nến ngày từ dữ liệu theo ngày: rows = [{ date, close, volume }] (đã qua withDailyDiffs).
 * API không có giá mở/cao/thấp trong ngày (low/high của API là số từ trước tới giờ), nên
 * giá mở = giá đóng ngày trước, cao/thấp = max/min của mở và đóng. Có ảnh chụp 15 phút
 * (intraday) cho ngày đó thì dùng cao/thấp thật từ ảnh chụp.
 */
function candlesFromDaily(rows, intraday = {}) {
  const out = [];
  let prevClose = null;
  for (const r of rows) {
    const close = r.close > 0 ? r.close : null;
    if (close == null) continue;
    const open = prevClose ?? close;
    const day = intraday[r.date];
    const high = Math.max(open, close, day?.high ?? 0);
    const low = Math.min(open, close, day?.low ?? Infinity);
    out.push({ time: Date.parse(`${r.date}T00:00:00Z`), open, high, low, close, volume: r.volume || 0, trades: r.trades || 0 });
    prevClose = close;
  }
  return out;
}

module.exports = { BUCKETS, candlesFromSnapshots, candlesFromDaily, withDailyDiffs, utcDay };
