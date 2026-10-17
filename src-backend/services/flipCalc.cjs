/**
 * Tính lãi/lỗ lướt sóng (FLIP) theo phương pháp FIFO từ lịch sử giao dịch marketplace.
 * Hàm thuần, không gọi DB hay API để dễ test.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Xác định farm là bên mua hay bên bán trong một giao dịch
 * @returns {'buy'|'sell'|null}
 */
function getTradeSide(trade, farmId) {
  const id = Number(farmId);
  if (trade.source === 'offer') {
    if (trade.initiatedBy?.id === id) return 'buy';
    if (trade.fulfilledBy?.id === id) return 'sell';
  } else if (trade.source === 'listing') {
    if (trade.initiatedBy?.id === id) return 'sell';
    if (trade.fulfilledBy?.id === id) return 'buy';
  }
  return null;
}

/**
 * Khoá ngày "YYYY-MM-DD" theo múi giờ lệch tzOffsetMinutes so với UTC
 */
function dayKey(ts, tzOffsetMinutes) {
  return new Date(ts + tzOffsetMinutes * 60 * 1000).toISOString().slice(0, 10);
}

function inRange(ts, from, to) {
  return (from == null || ts >= from) && (to == null || ts <= to);
}

function emptyResource(item) {
  return {
    item,
    boughtQty: 0,
    boughtCost: 0,
    soldQty: 0,
    soldGross: 0,
    soldAfterTax: 0,
    taxPaid: 0,
    matchedQty: 0,
    matchedCost: 0,
    realizedProfit: 0,
    realizedUsd: 0,
    wins: 0,
    losses: 0,
    holdQtyDays: 0,
    nonFlipQty: 0,
    nonFlipAfterTax: 0,
    usedQty: 0,
    usedCost: 0,
    lotIds: new Set(),
    openQty: 0,
    openCost: 0,
    marketPrice: null,
    openMarketValue: null,
    unrealizedProfit: null
  };
}

/**
 * @param {object[]} trades Giao dịch thô từ collection market_trades
 * @param {object} options
 * @param {string|number} options.farmId
 * @param {(trade) => string} options.resolveName Tên vật phẩm của giao dịch
 * @param {(trade, itemName) => number} options.taxRateFor Thuế (0..1) áp cho lệnh bán của farm
 * @param {(itemName) => boolean} [options.includeItem] Lọc vật phẩm (mặc định lấy tất cả)
 * @param {number} [options.from] Mốc thời gian (ms) bắt đầu, lọc theo thời điểm khớp
 * @param {number} [options.to] Mốc thời gian (ms) kết thúc
 * @param {number} [options.tzOffsetMinutes=420] Múi giờ gom theo ngày (mặc định UTC+7)
 * @param {Record<string, number>} [options.marketPrices] Giá thị trường hiện tại, để tính lãi chưa thực hiện
 * @param {(itemName) => number} [options.currentTaxRateFor] Thuế hiện tại, để quy giá trị lô đang giữ về sau thuế
 * @param {Record<string, number>} [options.inventory] Số lượng thật trong kho đồ, để trừ phần đã dùng khỏi lô đang giữ
 * @param {(itemName) => boolean} [options.tracksInventory] Món nào so với kho đồ (mặc định không món nào)
 */
function computeFlip(trades, options) {
  const {
    farmId,
    resolveName,
    taxRateFor,
    includeItem = () => true,
    from = null,
    to = null,
    tzOffsetMinutes = 420,
    marketPrices = {},
    currentTaxRateFor = () => 0,
    inventory = null,
    tracksInventory = () => false
  } = options;

  const sorted = [...trades]
    .filter(t => t && t.fulfilledAt && t.quantity > 0)
    .sort((a, b) => a.fulfilledAt - b.fulfilledAt || String(a.id).localeCompare(String(b.id)));

  const queues = {}; // item -> danh sách lô mua còn lại, cũ nhất trước
  const resources = {};
  const lots = [];
  const nonFlip = [];
  const daily = {};

  const getRes = item => (resources[item] ||= emptyResource(item));
  const getDay = ts => {
    const key = dayKey(ts, tzOffsetMinutes);
    return (daily[key] ||= { date: key, realizedProfit: 0, bought: 0, soldAfterTax: 0, taxPaid: 0 });
  };

  for (const trade of sorted) {
    const side = getTradeSide(trade, farmId);
    if (!side) continue;
    const item = resolveName(trade);
    if (!includeItem(item)) continue;

    const qty = Number(trade.quantity);
    const sfl = Number(trade.sfl) || 0;
    const ts = trade.fulfilledAt;
    const counted = inRange(ts, from, to);
    const usd = Number(trade.usdPriceAtTrade) || 0;

    if (side === 'buy') {
      (queues[item] ||= []).push({
        tradeId: trade.id,
        time: ts,
        qty,
        remaining: qty,
        unitCost: sfl / qty,
        source: trade.flipSource || 'api'
      });
      if (counted) {
        const res = getRes(item);
        res.boughtQty += qty;
        res.boughtCost += sfl;
        getDay(ts).bought += sfl;
      }
      continue;
    }

    // Lệnh bán: trừ thuế rồi ghép với các lô mua cũ nhất
    const taxRate = Math.min(1, Math.max(0, Number(taxRateFor(trade, item)) || 0));
    const net = sfl * (1 - taxRate);
    const unitGross = sfl / qty;
    const unitNet = net / qty;
    let toMatch = qty;
    const queue = queues[item] || [];

    while (toMatch > 0 && queue.length > 0) {
      const lot = queue[0];
      const take = Math.min(lot.remaining, toMatch);
      const cost = take * lot.unitCost;
      const proceeds = take * unitNet;
      const profit = proceeds - cost;
      const holdDays = (ts - lot.time) / DAY_MS;

      if (counted) {
        lots.push({
          item,
          buyTradeId: lot.tradeId,
          sellTradeId: trade.id,
          buyTime: lot.time,
          sellTime: ts,
          qty: take,
          buyPrice: lot.unitCost,
          sellPrice: unitGross,
          taxRate,
          cost,
          taxPaid: take * unitGross * taxRate,
          proceeds,
          profit,
          roi: cost > 0 ? profit / cost : 0,
          holdDays,
          profitUsd: profit * usd,
          buySource: lot.source,
          sellSource: trade.flipSource || 'api'
        });
        const res = getRes(item);
        res.matchedQty += take;
        res.matchedCost += cost;
        res.realizedProfit += profit;
        res.realizedUsd += profit * usd;
        res.holdQtyDays += holdDays * take;
        res.lotIds.add(lot.tradeId);
        if (profit > 0) res.wins++; else res.losses++;
        getDay(ts).realizedProfit += profit;
      }

      lot.remaining -= take;
      toMatch -= take;
      if (lot.remaining <= 1e-9) queue.shift();
    }

    if (counted) {
      const res = getRes(item);
      res.soldQty += qty;
      res.soldGross += sfl;
      res.soldAfterTax += net;
      res.taxPaid += sfl - net;
      const day = getDay(ts);
      day.soldAfterTax += net;
      day.taxPaid += sfl - net;

      // Phần bán không có lô mua tương ứng (đồ tự farm, hoặc mua trước khi có lịch sử)
      if (toMatch > 1e-9) {
        res.nonFlipQty += toMatch;
        res.nonFlipAfterTax += toMatch * unitNet;
        nonFlip.push({ item, sellTradeId: trade.id, sellTime: ts, qty: toMatch, afterTax: toMatch * unitNet, sellSource: trade.flipSource || 'api' });
      }
    }
  }

  // Kho đồ còn ít hơn số lô mua chưa bán thì phần chênh đã được dùng (ăn, chế đồ...): bỏ khỏi lô đang giữ,
  // lấy lô cũ nhất trước. Phần này không tính lãi/lỗ, chỉ ghi lại số lượng và vốn đã dùng
  if (inventory) {
    for (const [item, queue] of Object.entries(queues)) {
      if (!tracksInventory(item)) continue;
      const openQty = queue.reduce((acc, lot) => acc + lot.remaining, 0);
      let used = openQty - Math.max(0, Number(inventory[item]) || 0);
      if (used <= 1e-9) continue;
      const res = getRes(item);
      while (used > 1e-9 && queue.length > 0) {
        const lot = queue[0];
        const take = Math.min(lot.remaining, used);
        res.usedQty += take;
        res.usedCost += take * lot.unitCost;
        lot.remaining -= take;
        used -= take;
        if (lot.remaining <= 1e-9) queue.shift();
      }
    }
  }

  // Lô còn đang giữ (tính trên toàn bộ lịch sử, không phụ thuộc khoảng ngày)
  const openLots = [];
  for (const [item, queue] of Object.entries(queues)) {
    for (const lot of queue) {
      if (lot.remaining <= 1e-9) continue;
      const price = marketPrices[item];
      const cost = lot.remaining * lot.unitCost;
      const value = price > 0 ? lot.remaining * price * (1 - (currentTaxRateFor(item) || 0)) : null;
      openLots.push({
        item,
        buyTradeId: lot.tradeId,
        buyTime: lot.time,
        qty: lot.remaining,
        buyPrice: lot.unitCost,
        cost,
        marketPrice: price > 0 ? price : null,
        marketValueAfterTax: value,
        unrealizedProfit: value == null ? null : value - cost,
        buySource: lot.source
      });
      const res = getRes(item);
      res.openQty += lot.remaining;
      res.openCost += cost;
      if (price > 0) {
        res.marketPrice = price;
        res.openMarketValue = (res.openMarketValue || 0) + value;
        res.unrealizedProfit = (res.unrealizedProfit || 0) + (value - cost);
      }
    }
  }

  const resourceRows = Object.values(resources)
    .map(r => {
      const { lotIds, holdQtyDays, ...rest } = r;
      return {
        ...rest,
        avgBuyPrice: r.boughtQty > 0 ? r.boughtCost / r.boughtQty : null,
        avgSellPrice: r.soldQty > 0 ? r.soldGross / r.soldQty : null,
        roi: r.matchedCost > 0 ? r.realizedProfit / r.matchedCost : null,
        avgHoldDays: r.matchedQty > 0 ? holdQtyDays / r.matchedQty : null,
        lotsUsed: lotIds.size
      };
    })
    .sort((a, b) => b.realizedProfit - a.realizedProfit);

  const sum = key => resourceRows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  const wins = sum('wins');
  const losses = sum('losses');
  const matchedQty = sum('matchedQty');
  const matchedCost = sum('matchedCost');
  const realized = sum('realizedProfit');
  const unrealizedRows = resourceRows.filter(r => r.unrealizedProfit != null);

  const summary = {
    realizedProfit: realized,
    realizedUsd: sum('realizedUsd'),
    taxPaid: sum('taxPaid'),
    soldAfterTax: sum('soldAfterTax'),
    bought: sum('boughtCost'),
    nonFlipAfterTax: sum('nonFlipAfterTax'),
    matchedCost,
    roi: matchedCost > 0 ? realized / matchedCost : null,
    wins,
    losses,
    winRate: wins + losses > 0 ? wins / (wins + losses) : null,
    avgHoldDays: matchedQty > 0 ? lots.reduce((acc, l) => acc + l.holdDays * l.qty, 0) / matchedQty : null,
    openCost: sum('openCost'),
    usedCost: sum('usedCost'),
    unrealizedProfit: unrealizedRows.length ? unrealizedRows.reduce((acc, r) => acc + r.unrealizedProfit, 0) : null
  };

  let cumulative = 0;
  const dailyRows = Object.values(daily)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => {
      cumulative += d.realizedProfit;
      return { ...d, cumulativeProfit: cumulative };
    });

  return { summary, resources: resourceRows, lots, nonFlip, openLots, daily: dailyRows };
}

module.exports = { computeFlip, getTradeSide, dayKey };
