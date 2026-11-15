/**
 * Thanh khoản: mua bao nhiêu thì xả được, và lô đang giữ cần mấy ngày để xả.
 *
 * Lý do có file này (2026-11-15): app chỉ nói mua món gì, giá nào, không nói mua bao nhiêu. Người dùng ôm 368K Sunflower
 * 70 ngày: giá có lên nhưng game chỉ cho treo 20 đơn cùng lúc (Sunflower 4.000 cái/đơn = 80K mỗi lượt) nên xả không kịp.
 *
 * Mỗi ngày bán được tối đa = số nhỏ hơn giữa:
 *  - PARTICIPATION × lượng khớp trung vị mỗi ngày của món đó (14 ngày gần nhất): mình không thể là cả cái chợ;
 *  - 1 lượt treo đầy = MAX_LISTINGS đơn × số cái tối đa mỗi đơn của game.
 * Đây là GIẢ ĐỊNH thận trọng (20% lượng khớp, mỗi ngày hết 1 lượt treo), không backtest được vì lịch sử không ghi
 * lệnh của riêng mình có khớp hay không. Chỉnh bằng tham số nếu thực tế xả nhanh/chậm hơn.
 */
const DAY_MS = 86400000;
const DEFAULTS = {
  lookbackDays: 14,
  participation: 0.2,   // chiếm tối đa 20% lượng khớp mỗi ngày
  maxListings: 20,      // game cho treo tối đa 20 đơn cùng lúc
  sellDays: 5           // cửa sổ bán quanh đỉnh: 2 ngày trước đỉnh tới 2 ngày sau (backtest thoát lệnh ở đỉnh + 2)
};

const median = list => {
  const s = [...list].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

/** Lượng khớp (số cái) trung vị mỗi ngày trong lookbackDays ngày gần nhất; daily đã qua withDailyDiffs */
function dailyQuantity(daily, now = Date.now(), lookbackDays = DEFAULTS.lookbackDays) {
  const from = now - lookbackDays * DAY_MS;
  const list = daily
    .filter(d => d.quantity != null && d.quantity >= 0 && Date.parse(`${d.date}T00:00:00Z`) >= from && Date.parse(`${d.date}T00:00:00Z`) <= now)
    .map(d => d.quantity);
  return list.length >= 3 ? median(list) : null;
}

/**
 * Mỗi ngày bán được bao nhiêu cái.
 * @param {{ dailyQty: number|null, tradeLimit: number|null }} input tradeLimit = số cái tối đa mỗi đơn (game)
 * @returns {{ perDay: number, byMarket: number|null, byListings: number|null, limitedBy: 'market'|'listings' }|null}
 */
function sellCapacity({ dailyQty, tradeLimit }, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const byMarket = dailyQty > 0 ? dailyQty * opt.participation : null;
  const byListings = tradeLimit > 0 ? tradeLimit * opt.maxListings : null;
  if (byMarket == null && byListings == null) return null;
  const perDay = Math.floor(Math.min(byMarket ?? Infinity, byListings ?? Infinity));
  if (!(perDay > 0)) return null;
  return { perDay, byMarket, byListings, limitedBy: (byMarket ?? Infinity) <= (byListings ?? Infinity) ? 'market' : 'listings' };
}

/**
 * Nên mua tối đa bao nhiêu: xả hết được trong sellDays ngày quanh đỉnh, và không quá phần vốn dành cho món này.
 * @param {{ price: number, capacity: object|null, budget: number|null }} input budget = SFL dành cho món này (null = không biết số dư)
 * @returns {{ qty: number, cost: number, maxByLiquidity: number, maxByBudget: number|null, limitedBy: 'market'|'listings'|'budget', perDay: number, sellDays: number }|null}
 */
function buySize({ price, capacity, budget = null }, options = {}) {
  const opt = { ...DEFAULTS, ...options };
  if (!(price > 0) || !capacity) return null;
  const maxByLiquidity = capacity.perDay * opt.sellDays;
  const maxByBudget = budget != null && budget >= 0 ? Math.floor(budget / price) : null;
  const byBudget = maxByBudget != null && maxByBudget < maxByLiquidity;
  const qty = byBudget ? maxByBudget : maxByLiquidity;
  return { qty, cost: qty * price, maxByLiquidity, maxByBudget, limitedBy: byBudget ? 'budget' : capacity.limitedBy, perDay: capacity.perDay, sellDays: opt.sellDays };
}

/**
 * Kế hoạch xả một lô đang giữ: cần mấy ngày, mỗi ngày bao nhiêu, bắt đầu treo từ ngày nào để xong trước hạn.
 * @param {{ qty: number, capacity: object|null, deadline: string|null, today: string }} input deadline/today dạng YYYY-MM-DD (UTC); deadline null = bán ngay
 * @returns {{ perDay: number, days: number, startBy: string, late: boolean, limitedBy: string }|null} null nếu 1 ngày là xả xong
 */
function unloadPlan({ qty, capacity, deadline, today }) {
  if (!(qty > 0) || !capacity) return null;
  const days = Math.ceil(qty / capacity.perDay);
  if (days <= 1) return null;
  // Không có hạn (đang báo Bán ngay): xả luôn từ hôm nay, mất `days` ngày
  if (!deadline) return { perDay: capacity.perDay, days, startBy: today, late: false, limitedBy: capacity.limitedBy };
  const end = deadline >= today ? deadline : today;
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - (days - 1) * DAY_MS).toISOString().slice(0, 10);
  // Không kịp: tính lùi từ hạn bán thì ngày bắt đầu đã ở quá khứ → phải treo ngay từ hôm nay
  const late = start < today;
  return { perDay: capacity.perDay, days, startBy: late ? today : start, late, limitedBy: capacity.limitedBy };
}

module.exports = { dailyQuantity, sellCapacity, buySize, unloadPlan, DEFAULTS };
