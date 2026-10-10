/**
 * Ước tính các lệnh bị sót (API chỉ trả 50 giao dịch gần nhất) bằng cách so kho đồ và số dư FLOWER
 * giữa hai lần chụp farm. Hàm thuần để test.
 */

const EPS = 1e-6;
// Tiền thật lệch quá xa giá tham chiếu thì nhiều khả năng do thu hoạch/chế đồ chứ không phải giao dịch
const MIN_PRICE_RATIO = 0.2;
const MAX_PRICE_RATIO = 5;

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Chia một tổng tiền cho các món theo trọng số (số lượng × giá tham chiếu)
 */
function allocate(total, rows) {
  const weights = rows.map(r => r.qty * (r.refPrice > 0 ? r.refPrice : 0));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  return rows.map((r, i) => {
    const share = sumWeights > 0 ? weights[i] / sumWeights : 1 / rows.length;
    return { ...r, sfl: total * share };
  });
}

function priceRatioOk(actual, rows) {
  const estimated = rows.reduce((acc, r) => acc + (r.refPrice > 0 ? r.qty * r.refPrice : 0), 0);
  if (!(estimated > 0)) return true; // không có giá tham chiếu để so
  const ratio = actual / estimated;
  return ratio >= MIN_PRICE_RATIO && ratio <= MAX_PRICE_RATIO;
}

/**
 * @param {object} input
 * @param {{ at: number, balance: number, inventory: Record<string, number> }} input.before
 * @param {{ at: number, balance: number, inventory: Record<string, number> }} input.after
 * @param {{ side: 'buy'|'sell', item: string, qty: number, cost?: number, net?: number }[]} input.captured
 *   Lệnh đã bắt được trong khoảng (before.at, after.at]; cost = SFL đã trả khi mua, net = SFL nhận sau thuế khi bán
 * @param {(item: string) => boolean} input.isTradeable
 * @param {string[]} [input.focusItems] Món đang được gom quanh khoảng bị sót (ưu tiên chọn)
 * @param {(item: string, side: 'buy'|'sell') => number|null} input.refPrice Giá tham chiếu mỗi đơn vị (sau thuế với lệnh bán)
 * @param {number} input.at Thời điểm gán cho các lệnh bù
 */
function reconcileGap(input) {
  const { before, after, captured = [], isTradeable, focusItems = [], refPrice, at } = input;
  if (!before || !after) return { status: 'unresolved', reason: 'missing_snapshot', adjustments: [] };

  const capturedQty = {};
  let capturedSfl = 0;
  for (const t of captured) {
    const sign = t.side === 'buy' ? 1 : -1;
    capturedQty[t.item] = (capturedQty[t.item] || 0) + sign * t.qty;
    capturedSfl += t.side === 'buy' ? -toNumber(t.cost) : toNumber(t.net);
  }

  const items = new Set([...Object.keys(before.inventory || {}), ...Object.keys(after.inventory || {})]);
  const unexplained = [];
  for (const item of items) {
    if (!isTradeable(item)) continue;
    const delta = toNumber(after.inventory?.[item]) - toNumber(before.inventory?.[item]);
    const qty = delta - (capturedQty[item] || 0);
    if (Math.abs(qty) > EPS) unexplained.push({ item, qty });
  }
  const unexplainedSfl = toNumber(after.balance) - toNumber(before.balance) - capturedSfl;

  const focus = new Set(focusItems);
  let candidates = focus.size ? unexplained.filter(u => focus.has(u.item)) : unexplained;
  if (!candidates.length) candidates = unexplained;

  const buys = candidates.filter(c => c.qty > 0).map(c => ({ item: c.item, qty: c.qty, refPrice: refPrice(c.item, 'buy') }));
  const sells = candidates.filter(c => c.qty < 0).map(c => ({ item: c.item, qty: -c.qty, refPrice: refPrice(c.item, 'sell') }));
  const base = { unexplainedSfl, unexplainedItems: unexplained };

  if (!buys.length && !sells.length) {
    return { ...base, status: 'unresolved', reason: 'no_inventory_change', adjustments: [] };
  }

  let adjustments;
  if (buys.length && !sells.length) {
    const spent = -unexplainedSfl;
    if (!(spent > EPS)) return { ...base, status: 'unresolved', reason: 'balance_mismatch', adjustments: [] };
    if (!priceRatioOk(spent, buys)) return { ...base, status: 'unresolved', reason: 'price_mismatch', adjustments: [] };
    adjustments = allocate(spent, buys).map(r => ({ item: r.item, side: 'buy', qty: r.qty, sfl: r.sfl }));
  } else if (sells.length && !buys.length) {
    const earned = unexplainedSfl;
    if (!(earned > EPS)) return { ...base, status: 'unresolved', reason: 'balance_mismatch', adjustments: [] };
    if (!priceRatioOk(earned, sells)) return { ...base, status: 'unresolved', reason: 'price_mismatch', adjustments: [] };
    adjustments = allocate(earned, sells).map(r => ({ item: r.item, side: 'sell', qty: r.qty, sfl: r.sfl }));
  } else {
    // Vừa mua vừa bán: số dư chỉ cho biết tổng chênh, nên định giá từng món theo giá tham chiếu
    const all = [...buys.map(b => ({ ...b, side: 'buy' })), ...sells.map(s => ({ ...s, side: 'sell' }))];
    if (all.some(r => !(r.refPrice > 0))) return { ...base, status: 'unresolved', reason: 'no_reference_price', adjustments: [] };
    adjustments = all.map(r => ({ item: r.item, side: r.side, qty: r.qty, sfl: r.qty * r.refPrice }));
  }

  return {
    ...base,
    status: 'resolved',
    reason: buys.length && sells.length ? 'estimated_mixed' : 'balance_matched',
    adjustments: adjustments.map(a => ({ ...a, at }))
  };
}

module.exports = { reconcileGap, allocate };
