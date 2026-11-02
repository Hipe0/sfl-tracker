/**
 * Mẫu hình giá từ dữ liệu theo ngày (hàm thuần): xu hướng và chu kỳ theo thứ trong tuần.
 * Dùng cho mọi tài nguyên, nhất là món không theo mùa (Milk, Wood, Stone, Crimstone, Gold...).
 */

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const mean = v => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
function median(values) {
  const v = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Xu hướng: so trung bình 7 ngày với trung bình 30 ngày và độ dốc của trung bình 7 ngày trong 7 ngày qua.
 * 'down' = giá đang rơi đều (MA7 dưới MA30 quá 3% và MA7 còn giảm quá 2%/tuần) → không nên bắt đáy.
 * closes: giá đóng theo ngày, tăng dần theo thời gian.
 */
function trendOf(closes, { gap = 0.03, slope = 0.02 } = {}) {
  if (closes.length < 30) return { state: 'unknown', ma7: null, ma30: null, slope7: null };
  const ma7 = mean(closes.slice(-7));
  const ma30 = mean(closes.slice(-30));
  const ma7Prev = mean(closes.slice(-14, -7));
  const slope7 = ma7Prev > 0 ? ma7 / ma7Prev - 1 : 0;
  let state = 'flat';
  if (ma7 < ma30 * (1 - gap) && slope7 < -slope) state = 'down';
  else if (ma7 > ma30 * (1 + gap) && slope7 > slope) state = 'up';
  return { state, ma7, ma30, slope7 };
}

/**
 * Chu kỳ theo thứ (UTC): giá ngày / trung vị 7 ngày quanh nó, gom theo thứ rồi lấy trung vị.
 * Chỉ trả kết quả khi mỗi thứ có đủ mẫu và chênh lệch rẻ nhất–đắt nhất ≥ minAmplitude.
 * rows: [{ date, close }] tăng dần.
 */
function weekdayProfile(rows, { minSamples = 6, minAmplitude = 0.03 } = {}) {
  const valid = rows.filter(r => r.close > 0);
  const buckets = Array.from({ length: 7 }, () => []);
  valid.forEach((r, i) => {
    const base = median(valid.slice(Math.max(0, i - 3), i + 4).map(x => x.close));
    if (!(base > 0)) return;
    buckets[new Date(`${r.date}T12:00:00Z`).getUTCDay()].push(r.close / base);
  });
  if (buckets.some(b => b.length < minSamples)) return null;
  const index = buckets.map(median);
  let cheap = 0;
  let dear = 0;
  index.forEach((v, d) => {
    if (v < index[cheap]) cheap = d;
    if (v > index[dear]) dear = d;
  });
  const amplitude = index[dear] / index[cheap] - 1;
  if (!(amplitude >= minAmplitude)) return null;
  return { index, cheapDay: cheap, dearDay: dear, cheapLabel: WEEKDAYS[cheap], dearLabel: WEEKDAYS[dear], amplitude };
}

module.exports = { trendOf, weekdayProfile, WEEKDAYS };
