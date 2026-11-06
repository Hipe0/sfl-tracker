/**
 * Yêu cầu Kitchen của faction xoay vòng 12 tuần cố định (wiki.sfl.world/en/factions/request-rotation).
 * Mỗi tuần (bắt đầu thứ Hai 00:00 UTC) mỗi faction xin 3 tài nguyên; cả 4 faction dùng chung 12 bộ nhưng lệch thứ tự.
 *
 * Mốc: tuần 2026-11-02 là tuần 3 (API farm Bumpkins xác nhận: Eggplant/Rice/Barley).
 * Cả 4 faction cùng số tuần (người dùng xác nhận 2026-11-03). Kiểm chứng gián tiếp bằng giá: lệch số tuần 0 là
 * độ lệch làm món được xin tăng giá rõ nhất ở Nightshades, Goblins, Sunflorians (Bumpkins thì đã khớp API farm).
 *
 * Phân tích 2026-11-03 (46 tuần, thuế 10%): mua cuối tuần trước khi được xin, bán cuối tuần được xin
 * chỉ lãi ở vài món (Potato, Cabbage, Pumpkin, Soybean); walk-forward chọn món theo lịch sử của chính nó:
 * 26 lệnh, thắng 65%, +13.5%/lệnh. Phần lớn món khác lỗ sau thuế, nên chỉ báo Mua khi lịch sử món đó đủ tốt.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const ANCHOR = { monday: Date.UTC(2026, 10, 2), week: 3 };

// Tuần nhận thêm chìa khoá cho top 100 (Codex > Factions). Wiki: các ngày bắt đầu đã xác nhận cho năm 2026
const KEY_WEEKS = ['2026-01-19', '2026-01-26', '2026-02-23', '2026-03-23', '2026-04-27', '2026-05-25', '2026-06-22',
  '2026-07-27', '2026-08-24', '2026-09-28', '2026-10-26', '2026-11-23', '2026-12-21'];

/** Kitchen theo tuần 1..12 của từng faction */
const KITCHEN = {
  bumpkins: [
    { Pumpkin: 150, Egg: 20, Wool: 35 },
    { Soybean: 50, Apple: 12, Honey: 5 },
    { Eggplant: 20, Rice: 1, Barley: 30 },
    { Cauliflower: 25, Blueberry: 20, Olive: 1 },
    { Sunflower: 500, Tomato: 55, Leather: 10 },
    { Parsnip: 25, Olive: 1, Wood: 50 },
    { Beetroot: 30, Banana: 12, Grape: 2 },
    { Radish: 8, Grape: 1, Egg: 35 },
    { Potato: 250, Rice: 1, Oil: 3 },
    { Kale: 8, Honey: 3, Milk: 3 },
    { Cabbage: 100, Orange: 20, Rice: 2 },
    { Carrot: 75, Lemon: 35, Feather: 60 }
  ],
  goblins: [
    { Sunflower: 500, Tomato: 55, Leather: 10 },
    { Cabbage: 100, Orange: 20, Rice: 2 },
    { Kale: 8, Honey: 3, Milk: 3 },
    { Soybean: 50, Apple: 12, Honey: 5 },
    { Potato: 250, Rice: 1, Oil: 3 },
    { Eggplant: 20, Rice: 1, Barley: 30 },
    { Cauliflower: 25, Blueberry: 20, Olive: 1 },
    { Parsnip: 25, Olive: 1, Wood: 50 },
    { Carrot: 75, Lemon: 35, Feather: 60 },
    { Radish: 8, Grape: 1, Egg: 35 },
    { Beetroot: 30, Banana: 12, Grape: 2 },
    { Pumpkin: 150, Egg: 20, Wool: 35 }
  ],
  nightshades: [
    { Carrot: 75, Lemon: 35, Feather: 60 },
    { Cauliflower: 25, Blueberry: 20, Olive: 1 },
    { Parsnip: 25, Olive: 1, Wood: 50 },
    { Beetroot: 30, Banana: 12, Grape: 2 },
    { Pumpkin: 150, Egg: 20, Wool: 35 },
    { Radish: 8, Grape: 1, Egg: 35 },
    { Cabbage: 100, Orange: 20, Rice: 2 },
    { Kale: 8, Honey: 3, Milk: 3 },
    { Sunflower: 500, Tomato: 55, Leather: 10 },
    { Eggplant: 20, Rice: 1, Barley: 30 },
    { Soybean: 50, Apple: 12, Honey: 5 },
    { Potato: 250, Rice: 1, Oil: 3 }
  ],
  sunflorians: [
    { Potato: 250, Rice: 1, Oil: 3 },
    { Beetroot: 30, Banana: 12, Grape: 2 },
    { Radish: 8, Grape: 1, Egg: 35 },
    { Cabbage: 100, Orange: 20, Rice: 2 },
    { Carrot: 75, Lemon: 35, Feather: 60 },
    { Kale: 8, Honey: 3, Milk: 3 },
    { Soybean: 50, Apple: 12, Honey: 5 },
    { Eggplant: 20, Rice: 1, Barley: 30 },
    { Pumpkin: 150, Egg: 20, Wool: 35 },
    { Parsnip: 25, Olive: 1, Wood: 50 },
    { Cauliflower: 25, Blueberry: 20, Olive: 1 },
    { Sunflower: 500, Tomato: 55, Leather: 10 }
  ]
};

const FACTION_LABELS = { bumpkins: 'Bumpkins', goblins: 'Goblins', nightshades: 'Nightshades', sunflorians: 'Sunflorians' };

const mondayOf = ts => {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
};
const isoDate = ts => new Date(ts).toISOString().slice(0, 10);

/** Số tuần (1..12) của tuần chứa ts */
function weekIndexAt(ts) {
  const diff = Math.round((mondayOf(ts) - ANCHOR.monday) / WEEK_MS);
  return ((((ANCHOR.week - 1 + diff) % 12) + 12) % 12) + 1;
}

/** { Tên tài nguyên: [{ faction, qty }] } được xin trong tuần chứa ts */
function requestsAt(ts) {
  const week = weekIndexAt(ts);
  const out = {};
  for (const [faction, weeks] of Object.entries(KITCHEN)) {
    for (const [item, qty] of Object.entries(weeks[week - 1])) (out[item] ||= []).push({ faction, qty });
  }
  return out;
}

const isKeyWeek = ts => KEY_WEEKS.includes(isoDate(mondayOf(ts)));

/**
 * Lịch sử của 1 món: mỗi lần được xin, mua ở giá đóng cuối tuần trước, bán ở giá đóng cuối tuần được xin.
 * Chỉ dùng các tuần đã kết thúc trước now (không nhìn trước).
 * @param {Array<{date, close}>} daily
 */
function requestHistory(item, daily, now = Date.now(), taxRate = 0.1) {
  const closeBy = new Map(daily.filter(d => d.close > 0).map(d => [d.date, d.close]));
  const weekClose = monday => {
    for (let k = 6; k >= 0; k--) {
      const c = closeBy.get(isoDate(monday + k * DAY_MS));
      if (c) return c;
    }
    return null;
  };
  const first = daily.length ? mondayOf(Date.parse(`${daily[0].date}T00:00:00Z`)) : now;
  const trades = [];
  for (let m = first + WEEK_MS; m + WEEK_MS <= mondayOf(now); m += WEEK_MS) {
    if (!requestsAt(m)[item]) continue;
    const c0 = weekClose(m - WEEK_MS);
    const c1 = weekClose(m);
    if (c0 && c1) trades.push({ week: isoDate(m), gross: c1 / c0 - 1, net: c1 * (1 - taxRate) / c0 - 1, keyWeek: isKeyWeek(m) });
  }
  const n = trades.length;
  return {
    trades: n,
    winRate: n ? trades.filter(t => t.net > 0).length / n : null,
    avgNet: n ? trades.reduce((a, t) => a + t.net, 0) / n : null,
    avgGross: n ? trades.reduce((a, t) => a + t.gross, 0) / n : null,
    // Trung vị: vài tuần tăng vọt (+60–70%) kéo trung bình lên cao, dùng trung vị để đặt giá bán cho thực tế
    medianGross: n ? trades.map(t => t.gross).sort((a, b) => a - b)[Math.floor(n / 2)] : null,
    last: trades.slice(-4)
  };
}

/** Ngưỡng để báo Mua theo faction (khớp phân tích walk-forward ở trên) */
const MIN_TRADES = 6;
const MIN_AVG_NET = 0.05;
const MIN_WIN_RATE = 0.55;
const isGoodHistory = h => h.trades >= MIN_TRADES && h.avgNet >= MIN_AVG_NET && h.winRate >= MIN_WIN_RATE;

module.exports = { KITCHEN, KEY_WEEKS, FACTION_LABELS, weekIndexAt, requestsAt, isKeyWeek, requestHistory, isGoodHistory, mondayOf, MIN_AVG_NET };
