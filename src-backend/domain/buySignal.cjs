/**
 * Chấm điểm "có nên mua không, mua giá nào" cho một tài nguyên (hàm thuần, rule-based).
 *
 * Đầu vào lấy hết từ DB: giá theo ngày, ảnh chụp chợ mới nhất, supply theo ngày, lịch mùa, nhu cầu.
 * Không dùng ML: dữ liệu mới có vài vòng mùa (4 tuần/vòng), luật đơn giản dễ kiểm tra hơn.
 */
const { seasonAt, upcomingSeasons, SEASON_LABELS, DAY_MS } = require('./seasons.cjs');
const { trendOf, weekdayProfile } = require('./patterns.cjs');
const { describeCycle, DEFAULTS: CYCLE_DEFAULTS } = require('./seasonCycle.cjs');

const DEFAULTS = {
  minMargin: 0.10,        // lãi ròng sau thuế tối thiểu để báo "Mua"
  minTradesPerDay: 20,    // thanh khoản tối thiểu (số lệnh khớp/ngày, trung bình 7 ngày)
  lookbackDays: 30,       // cửa sổ tính phân vị giá
  seasonLookbackDays: 90, // cửa sổ tính hệ số mùa
  supplyWarn: 0.05,       // active supply tăng quá mức này trong 7 ngày thì cảnh báo
  trendFilter: true,      // giá đang rơi đều thì không báo Mua (tránh bắt dao rơi)
  weekdayLookbackDays: 84, // cửa sổ tính chu kỳ theo thứ (12 tuần)
  useCycle: true,         // có hồ sơ chu kỳ vòng mùa thì quyết định theo nó (backtest tốt hơn hẳn luật phân vị)
  cycleMinGain: CYCLE_DEFAULTS.minGain,
  cycleMinConsistency: CYCLE_DEFAULTS.minConsistency,
  cycleSellDrop: CYCLE_DEFAULTS.sellDrop,
  supplyLongDays: 90,     // xem supply 3 tháng
  supplyLongMinDays: 60,  // cần ít nhất 60 ngày supply mới dùng để chấm
  supplyLongWarn: 0.15    // supply 3 tháng tăng > 15% mà giá không tăng theo thì coi là áp lực bán
};

/**
 * Supply dài hạn so với giá trong cùng khoảng: supply tăng mạnh mà giá đứng/giảm là dấu hiệu dư hàng;
 * supply tăng mà giá vẫn tăng là nhu cầu đang hút hàng.
 */
function supplyVsPrice(supply, daily, now, days) {
  const from = now - days * DAY_MS;
  const list = supply.filter(s => s.supply > 0 && Date.parse(`${s.date}T00:00:00Z`) >= from && Date.parse(`${s.date}T00:00:00Z`) <= now);
  if (list.length < 2) return { spanDays: list.length ? 0 : null };
  const first = list[0];
  const last = list[list.length - 1];
  const spanDays = Math.round((Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / DAY_MS);
  const priceOn = date => {
    const rows = daily.filter(d => d.close > 0 && d.date <= date);
    return rows.length ? rows[rows.length - 1].close : null;
  };
  const p0 = priceOn(first.date);
  const p1 = priceOn(last.date);
  return {
    spanDays,
    from: first.date,
    supplyChange: last.supply / first.supply - 1,
    priceChange: p0 > 0 && p1 > 0 ? p1 / p0 - 1 : null
  };
}

function quantile(values, q) {
  const v = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

const median = values => quantile(values, 0.5);
const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/**
 * Hệ số mùa: giá ngày / trung vị 28 ngày quanh nó, gom theo mùa rồi lấy trung vị.
 * 1.10 nghĩa là trong mùa đó giá thường cao hơn mặt bằng 10%.
 */
function seasonalIndex(daily) {
  const rows = daily.filter(d => d.close > 0);
  const ratios = { spring: [], summer: [], autumn: [], winter: [] };
  rows.forEach((d, i) => {
    const window = rows.slice(Math.max(0, i - 14), i + 14).map(r => r.close);
    const base = median(window);
    if (!(base > 0)) return;
    ratios[seasonAt(Date.parse(`${d.date}T12:00:00Z`)).season].push(d.close / base);
  });
  const index = {};
  for (const [season, list] of Object.entries(ratios)) {
    index[season] = list.length >= 3 ? median(list) : null;
  }
  return index;
}

/**
 * @param {object} input
 * @param {string} input.item
 * @param {Array<{date,low,high,close,volume,trades}>} input.daily  tăng dần theo ngày
 * @param {{floor?:number,bestOffer?:number,listingCount?:number}} [input.current]  ảnh chụp chợ mới nhất
 * @param {Array<{date,supply,holders}>} [input.supply]
 * @param {number} [input.taxRate]  thuế bán của người dùng (0.075 = 7.5%)
 * @param {Array<{season,qty,source,label}>} [input.demand]  nhu cầu các mùa sắp tới có dùng món này
 * @param {number} [input.now]
 * @param {object} [input.backtest]  kết quả backtest của chính luật này trên lịch sử (domain/backtest.cjs)
 * @param {object} [input.cycle]  kế hoạch theo vòng mùa hôm nay (domain/seasonCycle.cjs cyclePlan)
 * @param {object} [input.options]
 */
function scoreItem({ item, daily = [], current = {}, supply = [], taxRate = 0.1, demand = [], now = Date.now(), backtest = null, cycle = null, options = {} }) {
  const opt = { ...DEFAULTS, ...options };
  const reasons = [];
  const recent = daily.filter(d => d.close > 0 && Date.parse(`${d.date}T00:00:00Z`) >= now - opt.lookbackDays * DAY_MS);
  const closes = recent.map(d => d.close);
  const lastClose = closes.length ? closes[closes.length - 1] : null;
  const price = current.floor > 0 ? current.floor : lastClose;

  const base = { item, price, decision: 'none', score: null, confidence: 'low', reasons, buyPrice: null, sellTarget: null, netMargin: null };
  if (!(price > 0) || closes.length < 7) {
    reasons.push(`Chưa đủ dữ liệu giá (mới có ${closes.length} ngày, cần ít nhất 7)`);
    return base;
  }

  const p25 = quantile(closes, 0.25);
  const p50 = median(closes);
  const p75 = quantile(closes, 0.75);
  const maxClose = Math.max(...closes);
  const percentile = closes.filter(c => c <= price).length / closes.length;

  // Thanh khoản 7 ngày gần nhất
  const last7 = recent.slice(-7);
  const avgTrades = mean(last7.map(d => d.trades || 0)) || 0;
  const avgVolume = mean(last7.map(d => d.volume || 0)) || 0;
  const spread = current.floor > 0 && current.bestOffer > 0 ? (current.floor - current.bestOffer) / current.floor : null;

  // Chu kỳ mùa
  const seasonWindow = daily.filter(d => Date.parse(`${d.date}T00:00:00Z`) >= now - opt.seasonLookbackDays * DAY_MS);
  const index = seasonalIndex(seasonWindow);
  const [nowSeason, ...nextSeasons] = upcomingSeasons(now, 4);
  let bestNext = null;
  if (index[nowSeason.season] > 0) {
    for (const s of nextSeasons) {
      if (index[s.season] > 0 && (!bestNext || index[s.season] > bestNext.index)) bestNext = { ...s, index: index[s.season] };
    }
  }
  const seasonalUplift = bestNext ? bestNext.index / index[nowSeason.season] - 1 : null;

  // Xu hướng (MA7 so với MA30) và chu kỳ theo thứ trong tuần
  const upToNow = daily.filter(d => d.close > 0 && Date.parse(`${d.date}T00:00:00Z`) <= now);
  const trend = trendOf(upToNow.slice(-60).map(d => d.close));
  const weekday = weekdayProfile(upToNow.filter(d => Date.parse(`${d.date}T00:00:00Z`) >= now - opt.weekdayLookbackDays * DAY_MS));

  // Supply 7 ngày
  let supplyChange = null;
  if (supply.length >= 2) {
    const last = supply[supply.length - 1];
    const weekAgo = supply.find(s => Date.parse(`${s.date}T00:00:00Z`) >= Date.parse(`${last.date}T00:00:00Z`) - 7 * DAY_MS);
    if (weekAgo && weekAgo.supply > 0 && weekAgo !== last) supplyChange = last.supply / weekAgo.supply - 1;
  }

  const supplyLong = supplyVsPrice(supply, daily, now, opt.supplyLongDays);
  const supplyLongUsable = supplyLong.spanDays != null && supplyLong.spanDays >= opt.supplyLongMinDays;
  const supplyGlut = supplyLongUsable && supplyLong.supplyChange > opt.supplyLongWarn && !(supplyLong.priceChange > 0);

  // Giá mua đề xuất: đang ở vùng rẻ thì mua luôn ở floor, không thì đặt offer ở P25 (không thấp hơn offer cao nhất đang treo)
  const buyPrice = percentile <= 0.25 ? price : Math.min(price, Math.max(p25, current.bestOffer || 0));
  const seasonalTarget = seasonalUplift != null && seasonalUplift > 0 ? p50 * (1 + seasonalUplift) : null;
  const sellTarget = Math.min(maxClose, Math.max(p75, seasonalTarget || 0));
  const netMargin = sellTarget * (1 - taxRate) / buyPrice - 1;

  // Điểm 0-100 (chỉ để xếp hạng, quyết định dựa vào các ngưỡng bên dưới)
  let score = 50 + (0.5 - percentile) * 60;
  if (seasonalUplift != null) score += Math.max(-20, Math.min(20, seasonalUplift * 100));
  if (demand.length) score += 10;
  if (supplyChange != null && supplyChange > opt.supplyWarn) score -= 10;
  if (avgTrades < opt.minTradesPerDay) score -= 20;
  if (trend.state === 'down') score -= 15;
  if (backtest && backtest.trades >= 3) score += Math.max(-20, Math.min(20, backtest.avgReturn * 100));
  if (opt.useCycle && cycle) score = 50 + Math.max(-40, Math.min(45, cycle.gain * cycle.consistency * 200)) - (avgTrades < opt.minTradesPerDay ? 20 : 0);
  score = Math.round(Math.max(0, Math.min(100, score)));

  reasons.push(`Giá ${price.toPrecision(4)} nằm ở phân vị ${Math.round(percentile * 100)}% của ${closes.length} ngày gần nhất (P25 ${p25.toPrecision(4)}, trung vị ${p50.toPrecision(4)}, P75 ${p75.toPrecision(4)})`);
  if (seasonalUplift != null) {
    reasons.push(`${SEASON_LABELS[bestNext.season]} (từ ${new Date(bestNext.startedAt).toISOString().slice(0, 10)}) giá thường ${seasonalUplift >= 0 ? 'cao' : 'thấp'} hơn mùa này ${Math.abs(seasonalUplift * 100).toFixed(1)}%`);
  } else {
    reasons.push('Chưa đủ dữ liệu để tính chu kỳ mùa (cần vài ngày mỗi mùa)');
  }
  for (const d of demand) reasons.push(`${d.label || d.source}: ${SEASON_LABELS[d.season] || d.season} cần ${d.qty}`);
  if (trend.state !== 'unknown') {
    const label = { down: 'đang giảm đều', up: 'đang tăng', flat: 'đi ngang' }[trend.state];
    reasons.push(`Xu hướng ${label}: TB 7 ngày ${trend.ma7.toPrecision(4)} so với TB 30 ngày ${trend.ma30.toPrecision(4)}, TB 7 ngày đổi ${(trend.slope7 * 100).toFixed(1)}% so với tuần trước`);
  }
  if (weekday) reasons.push(`Theo thứ (giờ UTC): thường rẻ nhất ${weekday.cheapLabel}, đắt nhất ${weekday.dearLabel}, chênh ${(weekday.amplitude * 100).toFixed(1)}%`);
  if (backtest) {
    reasons.push(backtest.trades
      ? `Backtest luật này trên lịch sử: ${backtest.trades} lệnh, thắng ${Math.round(backtest.winRate * 100)}%, lãi TB ${(backtest.avgReturn * 100).toFixed(1)}%/lệnh, giữ TB ${backtest.avgHoldDays.toFixed(1)} ngày`
      : 'Backtest: luật chưa từng báo Mua món này trên lịch sử');
  }
  if (supplyChange != null) reasons.push(`Active supply 7 ngày ${supplyChange >= 0 ? '+' : ''}${(supplyChange * 100).toFixed(1)}%`);
  reasons.push(`Thanh khoản: ~${Math.round(avgTrades)} lệnh/ngày, ~${Math.round(avgVolume)} SFL/ngày${spread != null ? `, chênh floor–offer ${(spread * 100).toFixed(1)}%` : ''}`);
  reasons.push(`Mua ${buyPrice.toPrecision(4)} → bán ${sellTarget.toPrecision(4)}, thuế ${(taxRate * 100).toFixed(1)}% → lãi ròng ${(netMargin * 100).toFixed(1)}%`);

  if (supplyLongUsable) {
    const pc = supplyLong.priceChange;
    reasons.push(`Supply ${supplyLong.spanDays} ngày (từ ${supplyLong.from}): ${supplyLong.supplyChange >= 0 ? '+' : ''}${(supplyLong.supplyChange * 100).toFixed(1)}%, giá cùng kỳ ${pc == null ? '?' : `${pc >= 0 ? '+' : ''}${(pc * 100).toFixed(1)}%`}${supplyGlut ? ' → hàng đang dư, cẩn thận' : ''}`);
  } else {
    reasons.push(`Supply mới thu được ${supplyLong.spanDays ?? 0} ngày, cần ~${opt.supplyLongMinDays} ngày mới dùng để chấm`);
  }

  let decision;
  let sellBy = null;
  let buyBy = null;
  let hardToFill = false;
  let cycleBuy = null;
  const useCycle = opt.useCycle && cycle;
  if (useCycle) {
    const text = describeCycle(cycle);
    if (text) reasons.push(text);
    const dateIn = d => new Date(now + d * DAY_MS).toISOString().slice(0, 10);
    const goodUp = cycle.gain >= opt.cycleMinGain && cycle.consistency >= opt.cycleMinConsistency;
    const goodDown = cycle.drop >= opt.cycleSellDrop && cycle.dropConsistency >= opt.cycleMinConsistency;
    cycleBuy = { gain: cycle.gain, consistency: cycle.consistency, rank: cycle.gain * cycle.consistency };
    // Giá mua/bán luôn lấy theo vòng mùa để bảng nhất quán (kể cả khi đang Chờ)
    const nowMode = cycle.mode === 'now';
    const last28 = daily.filter(d => d.close > 0 && Date.parse(`${d.date}T00:00:00Z`) > now - 28 * DAY_MS && Date.parse(`${d.date}T00:00:00Z`) <= now).map(d => d.close);
    const low28 = last28.length ? Math.min(...last28) : null;
    const planBuy = nowMode ? price : cycle.buyPrice;
    const planSell = nowMode ? price * (1 + cycle.upliftPct) : cycle.sellPrice;
    Object.assign(base, { buyPrice: planBuy, sellTarget: planSell });
    // Giá offer thấp hơn mọi giá đóng cửa 28 ngày qua thì gần như không khớp
    hardToFill = !nowMode && low28 != null && planBuy < low28 && planBuy < price;
    sellBy = dateIn(cycle.exitInDays);
    buyBy = nowMode ? dateIn(0) : dateIn(cycle.orderDays);
    const hits = `đúng ${Math.round(cycle.consistency * cycle.cycles)}/${cycle.cycles} vòng trước`;
    reasons.push(nowMode
      ? `Vòng mùa: khoảng ${dateIn(cycle.peakInDays)} giá thường cao hơn hôm nay ${(cycle.upliftPct * 100).toFixed(1)}% (${hits})`
      : `Vòng mùa: đáy thường rơi vào khoảng ${dateIn(cycle.buyInDays)} (~${planBuy.toPrecision(4)} gồm 5% cho dễ khớp), đỉnh khoảng ${dateIn(cycle.peakInDays)} (~${planSell.toPrecision(4)}), chênh ${(cycle.upliftPct * 100).toFixed(1)}% (${hits}). Mặt bằng giá hiện tại ~${cycle.level.toPrecision(4)}`);
    if (avgTrades < opt.minTradesPerDay) {
      decision = 'avoid';
      reasons.push('Không: thanh khoản thấp, mua vào khó bán ra');
    } else if (goodDown && !(goodUp && (nowMode ? !cycle.cheaperInDays : price <= planBuy))) {
      // Giá sắp rơi: ưu tiên báo Bán cho người đang giữ; nếu sau đó có đáy đẹp thì nhắc luôn giá offer
      decision = 'sell';
      reasons.push(`Bán: ${cycle.dropInDays} ngày tới giá thường giảm ~${(cycle.drop * 100).toFixed(1)}% (đúng ${Math.round(cycle.dropConsistency * cycle.cycles)}/${cycle.cycles} vòng trước). Đang giữ thì nên bán, chưa có thì đừng mua giá này`);
      if (goodUp && !nowMode) reasons.push(`Sau đó: đặt offer ${planBuy.toPrecision(4)} quanh ${dateIn(cycle.buyInDays)} (tới ${buyBy}) để mua lại ở đáy`);
      else { sellBy = null; buyBy = null; }
    } else if (goodUp && !(nowMode && cycle.cheaperInDays)) {
      if (supplyGlut) {
        decision = 'wait';
        reasons.push('Chờ: chu kỳ đẹp nhưng supply 3 tháng tăng mạnh mà giá không tăng');
      } else if (nowMode || price <= planBuy) {
        decision = 'buy';
        reasons.push(`Mua ngay: giá hiện tại ${price.toPrecision(4)} ${nowMode ? '' : 'đã ≤ giá đáy dự kiến, '}bán khi chạm ${planSell.toPrecision(4)}, chậm nhất ${sellBy}`);
        if (!nowMode) Object.assign(base, { buyPrice: price });
      } else {
        decision = 'buy';
        if (hardToFill) reasons.push(`Lưu ý: offer thấp hơn giá thấp nhất 28 ngày qua (${low28.toPrecision(4)}), có thể không khớp`);
        reasons.push(`Mua bằng offer: đặt offer ${planBuy.toPrecision(4)} (thấp hơn giá sàn ${((1 - planBuy / price) * 100).toFixed(1)}%), giữ tới ${buyBy}, không khớp thì huỷ. Khớp rồi thì treo bán ${planSell.toPrecision(4)}, chậm nhất ${sellBy}`);
      }
    } else if (goodUp) {
      decision = 'wait';
      reasons.push(`Chờ: khoảng ${dateIn(cycle.cheaperInDays)} giá thường rẻ hơn nữa ~${(cycle.cheaperPct * 100).toFixed(1)}%`);
    } else if (goodDown) {
      decision = 'sell';
      sellBy = null;
      buyBy = null;
      reasons.push(`Bán: ${cycle.dropInDays} ngày tới giá thường giảm ~${(cycle.drop * 100).toFixed(1)}% (đúng ${Math.round(cycle.dropConsistency * cycle.cycles)}/${cycle.cycles} vòng trước). Đang giữ thì nên bán, chưa có thì đừng mua`);
    } else {
      decision = 'wait';
      sellBy = null;
      buyBy = null;
      if (hardToFill) reasons.push(`Giá mua ${planBuy.toPrecision(4)} là mức để bán ${planSell.toPrecision(4)} trừ thuế còn lãi ≥ ${((cycle.minNetMargin ?? 0.15) * 100).toFixed(0)}%, nhưng thấp hơn giá thấp nhất 28 ngày qua (${low28.toPrecision(4)}) nên gần như không khớp. Biên độ mùa của món này nhỏ, không nên flip`);
      reasons.push(`Chờ: vòng mùa chưa cho điểm mua đủ chắc (chênh đáy–đỉnh sau thuế ${(cycle.gain * 100).toFixed(1)}%, đúng ${Math.round(cycle.consistency * 100)}% số vòng; cần ≥ ${(opt.cycleMinGain * 100).toFixed(0)}% và ≥ ${(opt.cycleMinConsistency * 100).toFixed(0)}%)`);
    }
  } else if (avgTrades < opt.minTradesPerDay) {
    decision = 'avoid';
    reasons.push('Không: thanh khoản thấp, mua vào khó bán ra');
  } else if (netMargin < opt.minMargin / 2) {
    decision = 'avoid';
    reasons.push(`Không: lãi ròng dưới ${(opt.minMargin * 50).toFixed(0)}%`);
  } else if (netMargin >= opt.minMargin && percentile <= 0.4 && !(supplyChange != null && supplyChange > opt.supplyWarn * 2)) {
    decision = 'buy';
    if (opt.trendFilter && trend.state === 'down') {
      decision = 'wait';
      reasons.push('Chờ: giá rẻ nhưng đang rơi đều, đợi chững lại rồi mới mua');
    } else if (backtest && backtest.trades >= 3 && backtest.avgReturn < 0) {
      decision = 'wait';
      reasons.push('Chờ: backtest cho thấy luật này lỗ với món này');
    } else if (opt.useCycle && trend.state !== 'up') {
      // Chưa đủ dữ liệu vòng mùa: luật phân vị đo được là lỗ với hàng giá đi xuống dài hạn
      // (Milk, Wood, Stone, Iron, Egg...), nên chỉ cho Mua khi giá đã quay đầu tăng.
      decision = 'wait';
      reasons.push('Chờ: chưa đủ 2 vòng mùa dữ liệu, chỉ báo Mua khi xu hướng đã tăng');
    }
  } else {
    decision = 'wait';
    reasons.push(`Chờ: đặt offer ở ${buyPrice.toPrecision(4)} thay vì mua floor`);
  }

  const days = daily.filter(d => d.close > 0).length;
  let confidence = days >= 56 && seasonalUplift != null ? 'high' : days >= 14 ? 'medium' : 'low';
  // Backtest đủ lệnh: lỗ thì tin cậy thấp, thắng ≥ 60% và có lãi thì nâng 1 bậc
  if (backtest && backtest.trades >= 3) {
    if (backtest.avgReturn < 0) confidence = 'low';
    else if (backtest.winRate >= 0.6 && confidence === 'medium') confidence = 'high';
  }
  if (useCycle) {
    // Theo vòng mùa: độ tin cậy dựa vào số vòng mùa đã đi đúng hướng
    const c = decision === 'sell' ? cycle.dropConsistency : cycle.consistency;
    confidence = c >= 0.9 && cycle.cycles >= 5 ? 'high' : c >= opt.cycleMinConsistency ? 'medium' : 'low';
    if (supplyGlut && confidence !== 'low') confidence = confidence === 'high' ? 'medium' : 'low';
  }

  return {
    ...base,
    decision,
    score,
    confidence,
    buyPrice: useCycle && base.buyPrice != null ? base.buyPrice : buyPrice,
    sellTarget: useCycle && base.sellTarget != null ? base.sellTarget : sellTarget,
    netMargin: useCycle && base.buyPrice != null && base.sellTarget != null ? base.sellTarget * (1 - taxRate) / base.buyPrice - 1 : netMargin,
    sellBy,
    buyBy,
    hardToFill,
    cycle: useCycle ? cycle : null,
    cycleBuy,
    supplyLong,
    percentile,
    p25,
    p50,
    p75,
    seasonalIndex: index,
    seasonalUplift,
    bestSeason: bestNext ? bestNext.season : null,
    supplyChange,
    trend,
    weekday,
    backtest: backtest ? { ...backtest, list: undefined } : null,
    avgTrades,
    avgVolume,
    spread,
    days
  };
}

module.exports = { scoreItem, seasonalIndex, supplyVsPrice, quantile, DEFAULTS };
