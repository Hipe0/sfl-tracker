/**
 * "Hàng trong kho": món người dùng tự làm ra (Wheat, Stone, Wood, Gold, Crimstone, Milk...) và muốn bán đúng đỉnh.
 * Khác Hàng đang giữ (lô mua trong Sổ Flip): không có giá vốn, không giới hạn số ngày giữ, chỉ báo Bán khi giá
 * thật sự tăng mạnh. Hàm thuần, chỉ dùng giá đóng cửa theo ngày.
 *
 * Nền = trung vị giá baseDays ngày trước đó (giá "bình thường" của món lúc đó). Tỉ lệ ngày = giá / nền.
 * Tăng mạnh = tỉ lệ thuộc nhóm 10% ngày cao nhất trong lịch sử CỦA CHÍNH MÓN ĐÓ (phân vị 90), và ít nhất +10%.
 * Đỉnh = ngày tăng mạnh và cao nhất trong ±sepDays ngày. Mức đỉnh TB = nền hiện tại × trung bình (giá đỉnh / nền).
 *
 * Luật bán mặc định ('p90'): giá hiện tại ≥ nền × ngưỡng tăng mạnh. Mức đỉnh TB chỉ để tham khảo (có thể lên tới đâu).
 * Luật 'avgpeak' (env STOCK_SELL_RULE=avgpeak): chỉ bán khi giá ≥ mức đỉnh TB.
 * Backtest 2025-12-17 → 2026-11-06 (mỗi ngày làm ra 1 cái, bán hết kho mỗi lần báo Bán, so với bán đều mỗi ngày,
 * hàng tồn cuối kỳ tính theo giá ngày cuối), TB 6 món Wheat/Stone/Wood/Gold/Crimstone/Milk: 'p90' +7,8%, 'avgpeak' −2,8%.
 * 'avgpeak' quá chặt: Stone, Crimstone, Milk không lần nào chạm mức đỉnh TB trong 265 ngày (một nửa số đỉnh nằm dưới TB).
 *
 * Lấy theo tỉ lệ so với nền chứ không lấy giá tuyệt đối, vì nền của các món này trôi theo tháng
 * (vd Stone 0,019 tháng 12 → 0,027 tháng 7 → 0,021 tháng 11): trung bình giá đỉnh cũ có thể không bao giờ quay lại.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_STOCK_ITEMS = ['Wheat', 'Stone', 'Wood', 'Gold', 'Crimstone', 'Milk'];

const DEFAULTS = {
  rule: 'p90',        // 'p90' | 'avgpeak'
  baseDays: 30,       // nền = trung vị 30 ngày trước
  quantile: 0.9,      // tăng mạnh = nhóm 10% ngày cao nhất so với nền
  minSpike: 0.10,     // và ít nhất +10% so với nền
  sepDays: 7,         // đỉnh cao nhất trong ±7 ngày (2 đỉnh cách nhau ít nhất 1 tuần)
  minHistory: 60,     // cần ≥ 60 ngày có tỉ lệ (≈ 75 ngày giá) mới tính ngưỡng
  minPeaks: 3,        // luật 'avgpeak' cần ≥ 3 đỉnh cũ
  nearRatio: 0.95     // giá ≥ 95% mức bán: "sắp tới đỉnh"
};

const median = xs => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const quantile = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null;
};
const dayTs = d => Date.parse(`${d}T00:00:00Z`);

/** Chuỗi giá ngày [{ date, close }] đã sắp xếp, bỏ ngày không có giá */
function cleanSeries(daily) {
  return (daily || []).filter(r => r && r.date && Number(r.close) > 0)
    .map(r => ({ date: r.date, t: dayTs(r.date), close: Number(r.close) }))
    .sort((a, b) => a.t - b.t);
}

/** Nền tại vị trí i: trung vị giá trong baseDays ngày trước ngày i (không gồm ngày i) */
function baseAt(series, i, baseDays) {
  const from = series[i].t - baseDays * DAY_MS;
  const xs = [];
  for (let j = i - 1; j >= 0 && series[j].t >= from; j--) xs.push(series[j].close);
  // Cần ít nhất nửa số ngày để nền có nghĩa
  return xs.length >= Math.ceil(baseDays / 2) ? median(xs) : null;
}

/** Tỉ lệ giá / nền của từng ngày (null khi chưa đủ nền) */
function ratioSeries(series, baseDays = DEFAULTS.baseDays) {
  return series.map((p, i) => {
    const b = baseAt(series, i, baseDays);
    return b ? p.close / b : null;
  });
}

/**
 * Các đỉnh đã xác nhận tính tới vị trí `upto`: tỉ lệ ≥ minRatio và cao nhất trong ±sepDays ngày.
 * Một ngày chỉ được xác nhận là đỉnh khi đã qua sepDays ngày sau nó (không nhìn trước tương lai).
 */
function findPeaks(series, { minRatio = 1 + DEFAULTS.minSpike, sepDays = DEFAULTS.sepDays, baseDays = DEFAULTS.baseDays, ratios } = {}, upto = series.length - 1) {
  const r = ratios || ratioSeries(series, baseDays);
  const peaks = [];
  const lastT = series[upto]?.t ?? -Infinity;
  for (let i = 0; i <= upto; i++) {
    const p = series[i];
    if (p.t + sepDays * DAY_MS > lastT) break;
    if (r[i] == null || r[i] < minRatio) continue;
    let isMax = true;
    for (let j = i - 1; j >= 0 && series[j].t >= p.t - sepDays * DAY_MS; j--) if (series[j].close >= p.close) { isMax = false; break; }
    if (isMax) for (let j = i + 1; j <= upto && series[j].t <= p.t + sepDays * DAY_MS; j++) if (series[j].close > p.close) { isMax = false; break; }
    if (isMax) peaks.push({ date: p.date, price: p.close, base: p.close / r[i], ratio: r[i] });
  }
  return peaks;
}

/**
 * Tín hiệu bán cho 1 món trong kho.
 * @param daily [{ date, close }] giá đóng cửa theo ngày
 * @param price giá hiện tại (giá sàn mới nhất); không có thì lấy giá đóng ngày cuối
 * @returns { decision: 'sell'|'near'|'hold'|'unknown', target (mức bán), peakTarget (mức đỉnh TB), base, ... }
 */
function stockSignal(daily, { price, ratios, ...opts } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const series = cleanSeries(daily);
  if (series.length < o.baseDays + 1) return { decision: 'unknown', reason: 'Chưa đủ dữ liệu giá', peaks: [], peakCount: 0, target: null };
  const last = series.length - 1;
  const r = ratios || ratioSeries(series, o.baseDays);
  const now = Number(price) > 0 ? Number(price) : series[last].close;
  const base = baseAt(series, last, o.baseDays) || median(series.slice(-o.baseDays).map(x => x.close));
  // Ngưỡng tăng mạnh chỉ học từ các ngày trước hôm nay
  const hist = r.slice(0, last).filter(x => x != null);
  const out = { price: now, base, ratioNow: base ? now / base : null, peaks: [], peakCount: 0, target: null, rule: o.rule };
  if (hist.length < o.minHistory) {
    return { ...out, decision: 'unknown', reason: `Mới có ${hist.length} ngày lịch sử, cần ${o.minHistory} ngày để biết thế nào là tăng mạnh với món này` };
  }
  const spikeRatio = Math.max(1 + o.minSpike, quantile(hist, o.quantile));
  const peaks = findPeaks(series, { minRatio: spikeRatio, sepDays: o.sepDays, ratios: r });
  const avgRatio = mean(peaks.map(p => p.ratio));
  Object.assign(out, {
    spikeRatio,
    peakCount: peaks.length,
    avgRatio,
    peakTarget: avgRatio ? base * avgRatio : null,
    avgPeakPrice: mean(peaks.map(p => p.price)),
    lastPeak: peaks[peaks.length - 1] || null,
    avgGapDays: peaks.length >= 2 ? (dayTs(peaks[peaks.length - 1].date) - dayTs(peaks[0].date)) / DAY_MS / (peaks.length - 1) : null,
    peaks: peaks.slice(-12)
  });
  const pctOf = x => `${((x - 1) * 100).toFixed(0)}%`;
  let target;
  if (o.rule === 'avgpeak') {
    if (peaks.length < o.minPeaks) {
      return { ...out, decision: 'unknown', reason: `Mới có ${peaks.length} đỉnh tăng mạnh (≥ +${pctOf(spikeRatio)}), chưa đủ ${o.minPeaks} để tính mức đỉnh TB` };
    }
    target = out.peakTarget;
  } else {
    target = base * spikeRatio;
  }
  out.target = target;
  out.toTarget = target / now - 1;
  const ref = out.peakTarget && out.peakTarget > target ? ` (đỉnh TB +${pctOf(avgRatio)}: ${out.peakTarget.toPrecision(4)})` : '';
  if (now >= target) {
    const over = out.peakTarget && now >= out.peakTarget;
    return {
      ...out,
      decision: 'sell',
      reason: over
        ? `Giá cao hơn nền ${pctOf(now / base)}, đã vượt cả mức đỉnh TB (+${pctOf(avgRatio)}): bán`
        : `Giá cao hơn nền ${pctOf(now / base)}, thuộc nhóm 10% ngày cao nhất của món này: bán.${ref ? ` Muốn cược thêm thì để lại một phần treo ở mức đỉnh TB ${out.peakTarget.toPrecision(4)} (+${pctOf(avgRatio)})` : ''}`
    };
  }
  if (now >= target * o.nearRatio) {
    return { ...out, decision: 'near', reason: `Còn ${(out.toTarget * 100).toFixed(1)}% nữa là tới mức bán ${target.toPrecision(4)}, chuẩn bị list` };
  }
  return { ...out, decision: 'hold', reason: `Giá ${now >= base ? 'cao' : 'thấp'} hơn nền ${pctOf(Math.max(now, base) / Math.min(now, base))}; tăng mạnh với món này là từ +${pctOf(o.rule === 'avgpeak' ? avgRatio : spikeRatio)}: giữ, chờ ${target.toPrecision(4)}${o.rule === 'avgpeak' ? '' : ref}` };
}

/**
 * Kiểm tra lại luật trên lịch sử (walk-forward): mỗi ngày chỉ dùng dữ liệu tới hôm đó.
 * Giả sử mỗi ngày làm ra 1 đơn vị và giữ trong kho; ngày nào báo Bán thì bán hết kho ở giá đóng ngày đó.
 * ratioWithUnsold > 1: luật bán được giá trung bình cao hơn bán đều mỗi ngày (hàng tồn cuối kỳ tính theo giá ngày cuối).
 */
function backtestStock(daily, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const series = cleanSeries(daily);
  const ratios = ratioSeries(series, o.baseDays);
  const startAt = o.baseDays * 2;
  let stock = 0;
  let revenue = 0;
  let sold = 0;
  let sellDays = 0;
  let maxWait = 0;
  let waited = 0;
  let flatSum = 0;
  let flatN = 0;
  for (let i = startAt; i < series.length; i++) {
    stock += 1;
    waited += 1;
    flatSum += series[i].close;
    flatN += 1;
    const sig = stockSignal(series.slice(0, i + 1), { ...o, price: series[i].close, ratios: ratios.slice(0, i + 1) });
    if (sig.decision === 'sell') {
      revenue += stock * series[i].close;
      sold += stock;
      stock = 0;
      sellDays += 1;
      maxWait = Math.max(maxWait, waited);
      waited = 0;
    }
  }
  const lastPrice = series[series.length - 1]?.close ?? null;
  const flat = flatN ? flatSum / flatN : null;
  return {
    days: Math.max(0, series.length - startAt),
    sellDays,
    unsold: stock,
    maxWait: Math.max(maxWait, waited),
    avgSellPrice: sold ? revenue / sold : null,
    avgPrice: flat,
    ratio: sold && flat ? revenue / sold / flat : null,
    ratioWithUnsold: flat && sold + stock ? (revenue + stock * (lastPrice || 0)) / (sold + stock) / flat : null,
    lastPrice
  };
}

module.exports = { DEFAULT_STOCK_ITEMS, DEFAULTS, findPeaks, ratioSeries, stockSignal, backtestStock, cleanSeries };
