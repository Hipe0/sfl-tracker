/**
 * Chu kỳ giá theo vòng mùa 4 tuần (hàm thuần, không gọi DB hay API).
 *
 * Mỗi vòng mùa có 28 "ô" (4 mùa × 7 ngày). Với từng ngày trong lịch sử, lấy độ lệch của giá so với
 * trung bình 28 ngày quanh nó (log giá), rồi gom theo ô. Kết quả cho biết ở từng ngày của vòng mùa,
 * giá thường cao/thấp hơn mặt bằng bao nhiêu %.
 *
 * Không cần luật viết tay cho từng món: số liệu tự cho thấy
 * - Corn (trồng mùa xuân, không dùng cho Lava Pit): đắt nhất mùa đông, rơi dần trong mùa xuân, rẻ nhất mùa hè.
 * - Onion (trồng mùa đông, Lava Pit mùa đông cần 400): đắt nhất ngay đầu mùa đông rồi giảm dần.
 *
 * Chỉ dùng dữ liệu tới ngày đang xét (độ lệch ngày i cần giá tới i+14, nên chỉ lấy i ≤ t−14), dùng được cho backtest.
 */
const { seasonAt, SEASONS, SEASON_LABELS, DAY_MS } = require('./seasons.cjs');

const SLOTS = 28;
const HALF = 14;
const DEFAULTS = {
  minPerSlot: 2,          // mỗi ô cần ít nhất 2 vòng mùa dữ liệu
  minGain: 0.15,          // lãi ròng kỳ vọng sau thuế tối thiểu để báo Mua
  minConsistency: 0.7,    // tỉ lệ vòng mùa trước đây giá đi đúng hướng
  minCycles: 3,           // số vòng mùa tối thiểu để tính tỉ lệ trên
  sellDrop: 0.10,         // giá kỳ vọng rơi ≥ 10% trong 14 ngày tới thì báo Bán
  maxHoldDays: 28,        // giữ tối đa 1 vòng mùa
  cheaperMargin: 0.02,    // (chế độ 'now') trong 6 ngày tới có ngày rẻ hơn ≥ 2% thì đợi
  // 'trough' = canh đáy: đặt offer ở giá đáy dự kiến trong 28 ngày tới; 'now' = mua ngay ở giá hiện tại.
  // Backtest 2026-11-02 (thuế 10%, top 3): trough thắng 83%, +22%/lệnh, tệ nhất −12%, nhưng 1/4 offer không khớp;
  // now thắng 79%, +18%/lệnh, tệ nhất −14%, vào nhiều lệnh hơn nên tổng lãi cả kỳ cao hơn.
  mode: 'trough',
  buyBuffer: 0.05,        // offer cao hơn giá đáy dự kiến 5% cho dễ khớp (backtest: 5% tốt hơn 0–3%)
  // Giá offer bị hạ xuống để bán ở giá mục tiêu trừ thuế vẫn lãi ≥ 15%. Backtest: không làm giảm lãi
  // (lệnh Mua vốn đã đủ lãi), chỉ chặn việc hiện giá mua mà bán ra lời mỏng hoặc lỗ ở các món đang Chờ.
  minNetMargin: 0.15,
  orderGraceDays: 3,      // offer giữ thêm 3 ngày sau ngày đáy dự kiến rồi huỷ
  // Cắt lỗ: TẮT. Backtest 2026-11-02 (thuế 10%, top 3): không cắt lỗ thắng 76%, +16%/lệnh;
  // cắt ở −20% chỉ còn thắng 57%, +6%/lệnh; cắt ở −15% thì lỗ. Giá theo mùa hay rơi sâu rồi hồi
  // trong vòng 28 ngày, cắt sớm là bán đúng đáy. Đặt số (vd 0.25) nếu muốn thử lại.
  stopLoss: null
};

const tsOf = date => Date.parse(`${date}T12:00:00Z`);

/** Ô (0-27) của thời điểm ts trong vòng mùa: mùa × 7 + ngày trong mùa */
function slotOf(ts) {
  const s = seasonAt(ts);
  return SEASONS.indexOf(s.season) * 7 + Math.min(6, Math.floor((ts - s.startedAt) / DAY_MS));
}

const cycleOf = ts => Math.floor(seasonAt(ts).weekIndex / 4);
const avg = list => list.reduce((a, b) => a + b, 0) / list.length;
const MAX_DEV = Math.log(2);
const median = list => {
  const v = list.slice().sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const circDist = (a, b) => Math.min((a - b + SLOTS) % SLOTS, (b - a + SLOTS) % SLOTS);

/** Chuẩn bị dữ liệu: bỏ ngày không có giá, tính độ lệch log giá so với trung bình 28 ngày quanh nó */
function prepare(daily) {
  const rows = daily.filter(d => d.close > 0);
  const logs = rows.map(r => Math.log(r.close));
  const dev = rows.map((_, i) => {
    if (i < HALF || i >= rows.length - HALF) return null;
    let sum = 0;
    for (let j = i - HALF; j < i + HALF; j++) sum += logs[j];
    // chặn ở ±log(2): giá gấp đôi/giảm nửa so với mặt bằng là bất thường, không để nó chi phối
    return Math.max(-MAX_DEV, Math.min(MAX_DEV, logs[i] - sum / (2 * HALF)));
  });
  return { rows, dev, slots: rows.map(r => slotOf(tsOf(r.date))), cycles: rows.map(r => cycleOf(tsOf(r.date))) };
}

/** Hồ sơ 28 ô từ dữ liệu tới chỉ số t (chỉ dùng độ lệch đã chốt: i ≤ t − 14). null nếu chưa đủ dữ liệu */
function profileAt(prep, t, minPerSlot = DEFAULTS.minPerSlot) {
  const bySlot = Array.from({ length: SLOTS }, () => []);
  for (let i = HALF; i <= t - HALF && i < prep.dev.length; i++) {
    if (prep.dev[i] != null) bySlot[prep.slots[i]].push(prep.dev[i]);
  }
  if (Math.min(...bySlot.map(l => l.length)) < minPerSlot) return null;
  // trung vị theo ô để 1 lần giá bất thường (vd lúc mới mở bán) không kéo lệch cả hồ sơ
  const raw = bySlot.map(median);
  // làm mượt 3 ngày (vòng tròn) cho đỡ nhiễu
  return raw.map((_, k) => (raw[(k + SLOTS - 1) % SLOTS] + raw[k] + raw[(k + 1) % SLOTS]) / 3);
}

/**
 * Tỉ lệ vòng mùa trước đây mà giá quanh ô `to` (±3 ngày) cao hơn (dir=1) / thấp hơn (dir=-1) giá quanh ô `from` (±1 ngày)
 */
function consistencyAt(prep, t, from, to, dir) {
  const byCycle = {};
  for (let i = HALF; i <= t - HALF && i < prep.dev.length; i++) {
    if (prep.dev[i] == null) continue;
    const c = (byCycle[prep.cycles[i]] ||= { from: [], to: [] });
    if (circDist(prep.slots[i], from) <= 1) c.from.push(prep.dev[i]);
    if (circDist(prep.slots[i], to) <= 3) c.to.push(prep.dev[i]);
  }
  let ok = 0;
  let total = 0;
  for (const c of Object.values(byCycle)) {
    if (!c.from.length || !c.to.length) continue;
    total++;
    if ((avg(c.to) - avg(c.from)) * dir > 0) ok++;
  }
  return { ratio: total ? ok / total : 0, cycles: total };
}

/**
 * Kế hoạch tại ngày chỉ số t (dùng chung cho đề xuất hiện tại và backtest).
 *
 * Chế độ 'trough' (mặc định, "canh đáy"): trong 28 ngày tới tìm cặp ngày mua b < ngày bán s có chênh lệch
 * hồ sơ lớn nhất. Giá dự kiến ngày k = mặt bằng hiện tại × (1 + độ lệch hồ sơ ở ô đó), trong đó mặt bằng ước
 * từ 7 ngày gần nhất đã bỏ yếu tố mùa. Giá mua = giá đáy dự kiến + buyBuffer (đặt offer), giá bán = giá đỉnh dự kiến.
 * Chế độ 'now': chỉ xét mua ngay hôm nay ở giá hiện tại (cách cũ).
 */
function planAt(prep, t, ts, { taxRate = 0.1, ...options } = {}) {
  const opt = { ...DEFAULTS, ...options };
  const pr = profileAt(prep, t, opt.minPerSlot);
  if (!pr) return null;
  const s0 = slotOf(ts);
  const at = k => pr[(s0 + k) % SLOTS];
  const close = prep.rows[t].close;

  // Mặt bằng (log) đã bỏ yếu tố mùa, trung vị 7 ngày gần nhất
  const levels = [];
  for (let j = Math.max(0, t - 6); j <= t; j++) levels.push(Math.log(prep.rows[j].close) - pr[prep.slots[j]]);
  const level = median(levels);

  const lastSell = opt.maxHoldDays - 2;
  const lastBuy = opt.mode === 'now' ? 0 : lastSell - 2;
  let best = -Infinity;
  let buyInDays = 0;
  let peakInDays = 1;
  for (let bDay = 0; bDay <= lastBuy; bDay++) {
    for (let sDay = bDay + 1; sDay <= lastSell; sDay++) {
      const v = at(sDay) - at(bDay);
      if (v > best) { best = v; buyInDays = bDay; peakInDays = sDay; }
    }
  }
  let buyPrice;
  let sellPrice;
  let cheaperInDays = null;
  let cheaperPct = 0;
  if (opt.mode === 'now') {
    buyPrice = close;
    sellPrice = close * Math.exp(best);
    let cheapest = 0;
    for (let k = 1; k <= 6; k++) {
      const v = at(k) - at(0);
      if (v < -opt.cheaperMargin && v < cheapest) { cheapest = v; cheaperInDays = k; }
    }
    cheaperPct = cheaperInDays ? 1 - Math.exp(cheapest) : 0;
  } else {
    buyPrice = Math.exp(level + at(buyInDays)) * (1 + opt.buyBuffer);
    sellPrice = Math.exp(level + at(peakInDays));
    // Không đặt offer ở giá mà bán ra trừ thuế lãi < minNetMargin: hạ offer xuống mức đủ lãi
    if (opt.minNetMargin != null) buyPrice = Math.min(buyPrice, sellPrice * (1 - taxRate) / (1 + opt.minNetMargin));
  }

  // Cho người ĐANG GIỮ hàng: giá cao nhất dự kiến từ hôm nay tới hết 28 ngày (không cần chờ đáy)
  let holdPeakInDays = 0;
  for (let k = 1; k <= lastSell; k++) if (at(k) > at(holdPeakInDays)) holdPeakInDays = k;
  const holdPeakPrice = Math.exp(level + at(holdPeakInDays));

  let fall = 0;
  let dropInDays = null;
  for (let k = 1; k <= 14; k++) {
    const v = at(0) - at(k);
    if (v > fall) { fall = v; dropInDays = k; }
  }
  const up = consistencyAt(prep, t, (s0 + buyInDays) % SLOTS, (s0 + peakInDays) % SLOTS, 1);
  const down = dropInDays ? consistencyAt(prep, t, s0, (s0 + dropInDays) % SLOTS, -1) : { ratio: 0, cycles: 0 };
  const seasonAvg = Object.fromEntries(SEASONS.map((s, i) => [s, Math.exp(avg(pr.slice(i * 7, i * 7 + 7))) - 1]));

  return {
    mode: opt.mode,
    minNetMargin: opt.minNetMargin,
    slot: s0,
    season: SEASONS[Math.floor(s0 / 7)],
    profile: pr.map(v => Math.exp(v) - 1),
    level: Math.exp(level),
    upliftPct: Math.exp(best) - 1,
    // lãi kỳ vọng nếu mua đúng đáy và bán đúng đỉnh (để xếp hạng, không tính buffer)
    gain: Math.exp(best) * (1 - taxRate) - 1,
    buyPrice,
    sellPrice,
    netMargin: sellPrice * (1 - taxRate) / buyPrice - 1,
    buyInDays,
    orderDays: opt.mode === 'now' ? 0 : buyInDays + opt.orderGraceDays,
    peakInDays,
    exitInDays: Math.min(opt.maxHoldDays, peakInDays + 2),
    holdPeakInDays,
    holdPeakPrice,
    consistency: up.cycles >= opt.minCycles ? up.ratio : 0,
    cycles: up.cycles,
    cheaperInDays,
    cheaperPct,
    drop: 1 - Math.exp(-fall),
    dropInDays,
    dropConsistency: down.cycles >= opt.minCycles ? down.ratio : 0,
    seasonAvg
  };
}

/** Kế hoạch cho hôm nay từ toàn bộ dữ liệu ngày của 1 tài nguyên */
function cyclePlan(daily, now = Date.now(), options = {}) {
  const prep = prepare(daily.filter(d => tsOf(d.date) <= now));
  if (prep.rows.length < SLOTS * 2 + HALF) return null;
  return planAt(prep, prep.rows.length - 1, now, options);
}

/** Câu mô tả chu kỳ mùa của 1 món, để hiện ở phần lý do */
function describeCycle(plan) {
  if (!plan) return null;
  const entries = Object.entries(plan.seasonAvg).sort((a, b) => b[1] - a[1]);
  const [hi] = entries;
  const lo = entries[entries.length - 1];
  return `Theo vòng mùa: đắt nhất ${SEASON_LABELS[hi[0]]} (${hi[1] >= 0 ? '+' : ''}${(hi[1] * 100).toFixed(0)}% so với mặt bằng), rẻ nhất ${SEASON_LABELS[lo[0]]} (${(lo[1] * 100).toFixed(0)}%)`;
}

/**
 * Backtest danh mục theo chu kỳ mùa (walk-forward, không nhìn trước):
 * mỗi ngày chọn tối đa topN món có lãi kỳ vọng cao nhất đang thoả điều kiện Mua, mua ở giá đóng,
 * bán khi giá đóng ≥ giá mục tiêu hoặc tới hạn (đỉnh dự kiến + 2 ngày, tối đa 28 ngày).
 * @param {Record<string, Array>} dailyBy
 */
function simulatePortfolio(dailyBy, { taxRate = 0.1, topN = 3, warmupDays = 84, ...options } = {}) {
  const opt = { ...DEFAULTS, ...options };
  const items = Object.fromEntries(Object.entries(dailyBy).map(([item, daily]) => {
    const prep = prepare(daily);
    return [item, { prep, index: Object.fromEntries(prep.rows.map((r, i) => [r.date, i])) }];
  }));
  const dates = [...new Set(Object.values(items).flatMap(x => x.prep.rows.map(r => r.date)))].sort();
  const addDays = (ts, d) => new Date(ts + d * DAY_MS).toISOString().slice(0, 10);
  const open = [];
  const trades = [];
  let expired = 0;
  for (const date of dates) {
    const ts = tsOf(date);
    const isLast = date === dates[dates.length - 1];
    for (let p = open.length - 1; p >= 0; p--) {
      const o = open[p];
      const i = items[o.item].index[date];
      if (i == null) continue;
      const close = items[o.item].prep.rows[i].close;
      if (!o.filled) {
        // offer đang treo: giá đóng ≤ giá offer thì coi như khớp ở giá offer
        if (close <= o.limit) Object.assign(o, { filled: true, price: o.limit, date });
        else if (date >= o.orderUntil || isLast) { open.splice(p, 1); expired++; }
        continue;
      }
      const ret = close * (1 - taxRate) / o.price - 1;
      const stopped = opt.stopLoss != null && ret <= -opt.stopLoss;
      if (close >= o.target || date >= o.exitDate || isLast || stopped) {
        trades.push({ item: o.item, buyDate: o.date, buy: o.price, sellDate: date, sell: close,
          holdDays: Math.round((ts - tsOf(o.date)) / DAY_MS), ret,
          reason: close >= o.target ? 'target' : stopped ? 'stop' : isLast ? 'end' : 'timeout' });
        open.splice(p, 1);
      }
    }
    if (open.length >= topN) continue;
    const candidates = [];
    for (const [item, { prep, index }] of Object.entries(items)) {
      if (open.some(o => o.item === item)) continue;
      const i = index[date];
      if (i == null || i < warmupDays) continue;
      const plan = planAt(prep, i, ts, { ...opt, taxRate });
      if (!plan || plan.gain < opt.minGain || plan.consistency < opt.minConsistency || plan.cheaperInDays) continue;
      if (plan.netMargin < opt.minGain / 2) continue;
      candidates.push({ item, limit: plan.buyPrice, target: plan.sellPrice, rank: plan.gain * plan.consistency,
        orderUntil: addDays(ts, plan.orderDays), exitDate: addDays(ts, plan.exitInDays) });
    }
    candidates.sort((a, b) => b.rank - a.rank);
    for (const c of candidates) {
      if (open.length >= topN) break;
      const close = items[c.item].prep.rows[items[c.item].index[date]].close;
      // Lúc đặt mà giá sàn đã ≤ giá offer thì mua thẳng listing ở giá sàn
      if (close <= c.limit) Object.assign(c, { filled: true, price: close, date });
      open.push(c);
    }
  }
  const n = trades.length;
  const half = dates[Math.floor(dates.length / 2)];
  const stats = list => {
    const k = list.length;
    return {
      trades: k,
      winRate: k ? list.filter(t => t.ret > 0).length / k : null,
      avgReturn: k ? avg(list.map(t => t.ret)) : null,
      worst: k ? Math.min(...list.map(t => t.ret)) : null,
      avgHoldDays: k ? avg(list.map(t => t.holdDays)) : null,
      timeouts: list.filter(t => t.reason === 'timeout').length
    };
  };
  return {
    ...stats(trades),
    secondHalf: { from: half, ...stats(trades.filter(t => t.buyDate >= half)) },
    from: dates[0] || null,
    to: dates[dates.length - 1] || null,
    expiredOrders: expired,
    options: { taxRate, topN, mode: opt.mode, minGain: opt.minGain, minConsistency: opt.minConsistency, maxHoldDays: opt.maxHoldDays },
    list: trades.slice(-30),
    count: n
  };
}

module.exports = { slotOf, prepare, profileAt, planAt, cyclePlan, describeCycle, simulatePortfolio, DEFAULTS, SLOTS };
