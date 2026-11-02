/**
 * Backtest (kiểm thử lại trên dữ liệu cũ) luật điểm mua cho 1 tài nguyên (hàm thuần).
 *
 * Mỗi ngày t chỉ dùng dữ liệu tới ngày t để ra quyết định (không nhìn trước tương lai):
 * - Quyết định "Mua": đặt lệnh mua ở buyPrice. Giá đóng ngày t ≤ buyPrice thì khớp luôn ở giá đóng,
 *   không thì lệnh treo 3 ngày, ngày nào giá đóng ≤ buyPrice thì khớp ở buyPrice.
 * - Đang giữ hàng: ngày nào giá đóng ≥ sellTarget thì bán ở giá đóng; giữ quá maxHoldDays thì bán ở giá đóng (cắt).
 * - Lãi mỗi lệnh = giá bán × (1 − thuế) / giá mua − 1. Giữ tối đa 1 vị thế mỗi lúc.
 * Chỉ có giá đóng theo ngày nên đây là ước lượng, không tính trượt giá hay độ sâu sổ lệnh.
 */
const { scoreItem } = require('./buySignal.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const ts = date => Date.parse(`${date}T12:00:00Z`);

/**
 * @param {object} p
 * @param {Array} p.daily  [{ date, close, trades, volume }] tăng dần, đã đổi số luỹ kế sang số trong ngày
 * @param {number} p.taxRate
 * @param {(now:number)=>Array} [p.demandAt]  nhu cầu tại thời điểm (Lava Pit...)
 * @param {object} [p.options]  truyền vào scoreItem (vd { trendFilter: false } để so luật cũ)
 */
function backtestItem({ item, daily, taxRate = 0.1, demandAt = () => [], options = {}, warmupDays = 30, maxHoldDays = 28, orderDays = 3 }) {
  const rows = daily.filter(d => d.close > 0);
  const trades = [];
  let position = null;
  let order = null;
  for (let t = warmupDays; t < rows.length; t++) {
    const day = rows[t];
    if (position) {
      const held = (ts(day.date) - ts(position.date)) / DAY_MS;
      if (day.close >= position.sellTarget || held >= maxHoldDays || t === rows.length - 1) {
        const ret = (day.close * (1 - taxRate)) / position.price - 1;
        trades.push({ buyDate: position.date, buy: position.price, sellDate: day.date, sell: day.close, holdDays: held, ret, reason: day.close >= position.sellTarget ? 'target' : held >= maxHoldDays ? 'timeout' : 'end' });
        position = null;
      }
      continue;
    }
    if (order) {
      if (day.close <= order.price) {
        position = { date: day.date, price: order.price, sellTarget: order.sellTarget };
        order = null;
        continue;
      }
      if (t > order.until) order = null;
    }
    if (order) continue;
    const s = scoreItem({ item, daily: rows.slice(0, t + 1), current: { floor: day.close }, taxRate, demand: demandAt(ts(day.date)), now: ts(day.date) + 11 * 60 * 60 * 1000, options: { useCycle: false, ...options } });
    if (s.decision !== 'buy') continue;
    if (day.close <= s.buyPrice) position = { date: day.date, price: day.close, sellTarget: s.sellTarget };
    else order = { price: s.buyPrice, sellTarget: s.sellTarget, until: t + orderDays };
  }
  return summarize(trades);
}

function summarize(trades) {
  const n = trades.length;
  const wins = trades.filter(t => t.ret > 0).length;
  const avgReturn = n ? trades.reduce((a, t) => a + t.ret, 0) / n : null;
  const compounded = trades.reduce((a, t) => a * (1 + t.ret), 1) - 1;
  return {
    trades: n,
    wins,
    winRate: n ? wins / n : null,
    avgReturn,
    compounded: n ? compounded : null,
    avgHoldDays: n ? trades.reduce((a, t) => a + t.holdDays, 0) / n : null,
    worst: n ? Math.min(...trades.map(t => t.ret)) : null,
    timeouts: trades.filter(t => t.reason === 'timeout').length,
    list: trades
  };
}

module.exports = { backtestItem, summarize };
