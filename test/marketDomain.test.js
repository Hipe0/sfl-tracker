import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const seasons = require('../src-backend/domain/seasons.cjs');
const { scoreItem, quantile } = require('../src-backend/domain/buySignal.cjs');
const { candlesFromSnapshots, candlesFromDaily, withDailyDiffs } = require('../src-backend/domain/candles.cjs');

const DAY = 24 * 60 * 60 * 1000;
const date = ts => new Date(ts).toISOString().slice(0, 10);

describe('seasons', () => {
  it('2026-11-02 là mùa thu, tuần sau mùa đông', () => {
    const now = Date.UTC(2026, 10, 2, 10);
    expect(seasons.seasonAt(now).season).toBe('autumn');
    expect(seasons.seasonAt(now).startedAt).toBe(Date.UTC(2026, 10, 2));
    expect(seasons.upcomingSeasons(now, 2)[1].season).toBe('winter');
  });

  it('mốc đầu tiên 2024-12-16 là mùa xuân', () => {
    expect(seasons.seasonAt(Date.UTC(2024, 11, 16, 1)).season).toBe('spring');
    expect(seasons.seasonAt(Date.UTC(2024, 11, 23, 1)).season).toBe('summer');
  });

  it('dải mùa phủ đủ khoảng thời gian', () => {
    const from = Date.UTC(2026, 9, 3);
    const to = Date.UTC(2026, 10, 2, 12);
    const bands = seasons.seasonBands(from, to);
    expect(bands[0].from).toBe(from);
    expect(bands[bands.length - 1].to).toBe(to);
    for (let i = 1; i < bands.length; i++) expect(bands[i].from).toBe(bands[i - 1].to);
  });

  it('cây chỉ trồng 1 mùa', () => {
    expect(seasons.isSingleSeasonCrop('Pumpkin')).toBe(true);
    expect(seasons.isSingleSeasonCrop('Wheat')).toBe(false);
    expect(seasons.seasonsForItem('Wood')).toEqual([]);
  });

  it('tuần trong chapter, chapter chưa khai báo thì đếm từ ngày kết thúc chapter cuối', () => {
    const chapters = { A: { startDate: Date.UTC(2026, 7, 3), endDate: Date.UTC(2026, 10, 2) } };
    expect(seasons.chapterAt(Date.UTC(2026, 7, 11), chapters)).toMatchObject({ name: 'A', week: 2 });
    expect(seasons.chapterAt(Date.UTC(2026, 10, 3), chapters)).toMatchObject({ name: null, week: 1 });
  });
});

const NOW = Date.UTC(2026, 10, 2, 12);
const series = (fn, n = 60) => Array.from({ length: n }, (_, i) => {
  const ts = NOW - (n - i) * DAY;
  return { date: date(ts), close: fn(i, ts), low: fn(i, ts) * 0.95, high: fn(i, ts) * 1.05, volume: 1000, trades: 100 };
});

describe('buySignal', () => {
  const now = NOW;

  it('quantile', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
  });

  it('thiếu dữ liệu thì không đề xuất', () => {
    const r = scoreItem({ item: 'X', daily: series(() => 1, 3), now });
    expect(r.decision).toBe('none');
  });

  it('luật phân vị cũ (useCycle: false): giá ở đáy, biên độ lớn, thanh khoản tốt → Mua', () => {
    const daily = series(i => 1 + 0.3 * Math.sin(i / 3));
    const r = scoreItem({ item: 'X', daily, current: { floor: 0.72, bestOffer: 0.7 }, taxRate: 0.075, now, options: { useCycle: false } });
    expect(r.decision).toBe('buy');
    expect(r.buyPrice).toBeLessThanOrEqual(0.72);
    expect(r.netMargin).toBeGreaterThan(0.1);
  });

  it('thanh khoản thấp → Không', () => {
    const daily = series(i => 1 + 0.3 * Math.sin(i / 3)).map(d => ({ ...d, trades: 2 }));
    const r = scoreItem({ item: 'X', daily, current: { floor: 0.72 }, taxRate: 0.075, now });
    expect(r.decision).toBe('avoid');
  });

  it('giá phẳng, thuế ăn hết lãi → Không', () => {
    const r = scoreItem({ item: 'X', daily: series(() => 1), current: { floor: 1 }, taxRate: 0.15, now });
    expect(r.decision).toBe('avoid');
  });

  it('giá đang ở đỉnh → không báo Mua', () => {
    const daily = series(i => 1 + 0.3 * Math.sin(i / 3));
    const r = scoreItem({ item: 'X', daily, current: { floor: 1.29 }, taxRate: 0.075, now });
    expect(r.decision).not.toBe('buy');
  });

  it('tính hệ số mùa khi giá có chu kỳ theo mùa', () => {
    // mùa đông (winter) giá cao gấp rưỡi
    const daily = series((i, ts) => (seasons.seasonAt(ts + 12 * 60 * 60 * 1000).season === 'winter' ? 1.5 : 1), 84);
    const r = scoreItem({ item: 'X', daily, current: { floor: 1 }, taxRate: 0.075, now });
    expect(r.seasonalIndex.winter).toBeGreaterThan(r.seasonalIndex.autumn);
    expect(r.bestSeason).toBe('winter');
    expect(r.seasonalUplift).toBeGreaterThan(0.2);
  });
});

describe('candles', () => {
  it('nến từ ảnh chụp: volume là phần tăng của số luỹ kế', () => {
    const t0 = Date.UTC(2026, 10, 1, 10);
    const pts = [
      { timestamp: t0, price: 1, volume: 100 },
      { timestamp: t0 + 15 * 60000, price: 2, volume: 150 },
      { timestamp: t0 + 60 * 60000, price: 1.5, volume: 160 }
    ];
    const c = candlesFromSnapshots(pts, '1h');
    expect(c).toHaveLength(2);
    expect(c[0]).toMatchObject({ open: 1, high: 2, low: 1, close: 2, volume: 50 });
    expect(c[1]).toMatchObject({ close: 1.5, volume: 10 });
  });

  it('số luỹ kế theo ngày → số trong ngày, thiếu ngày liền trước thì null', () => {
    const r = withDailyDiffs([
      { date: '2026-10-30', cumVolume: 100, cumTrades: 10 },
      { date: '2026-10-31', cumVolume: 160, cumTrades: 15 },
      { date: '2026-11-02', cumVolume: 200, cumTrades: 20 }
    ]);
    expect(r.map(x => x.volume)).toEqual([null, 60, null]);
    expect(r[1].trades).toBe(5);
  });

  it('nến ngày: giá mở = giá đóng hôm trước, cao/thấp lấy thêm từ ảnh chụp trong ngày', () => {
    const c = candlesFromDaily([
      { date: '2026-11-01', close: 1 },
      { date: '2026-11-02', close: 1.2 }
    ], { '2026-11-02': { high: 1.5, low: 0.9 } });
    expect(c[1]).toMatchObject({ open: 1, close: 1.2, high: 1.5, low: 0.9 });
    expect(c[0]).toMatchObject({ open: 1, high: 1, low: 1 });
  });
});

describe('patterns + backtest', () => {
  const { trendOf, weekdayProfile } = require('../src-backend/domain/patterns.cjs');
  const { backtestItem } = require('../src-backend/domain/backtest.cjs');
  const now = Date.UTC(2026, 10, 2, 12);
  const mk = (fn, n) => Array.from({ length: n }, (_, i) => {
    const t = now - (n - i) * DAY;
    return { date: date(t), close: fn(i, t), trades: 100, volume: 1000 };
  });

  it('xu hướng giảm đều / tăng / đi ngang', () => {
    expect(trendOf(Array.from({ length: 40 }, (_, i) => 2 - i * 0.03)).state).toBe('down');
    expect(trendOf(Array.from({ length: 40 }, (_, i) => 1 + i * 0.03)).state).toBe('up');
    expect(trendOf(Array.from({ length: 40 }, () => 1)).state).toBe('flat');
    expect(trendOf([1, 2, 3]).state).toBe('unknown');
  });

  it('chu kỳ theo thứ: thứ Hai rẻ hơn', () => {
    const rows = mk((i, t) => (new Date(t).getUTCDay() === 1 ? 0.9 : 1), 84);
    const w = weekdayProfile(rows);
    expect(w.cheapLabel).toBe('T2');
    expect(w.amplitude).toBeGreaterThan(0.05);
    expect(weekdayProfile(mk(() => 1, 84))).toBeNull();
  });

  it('giá đang rơi đều thì không báo Mua dù ở đáy', () => {
    const daily = mk(i => 2 - i * 0.02, 60);
    const r = scoreItem({ item: 'X', daily, current: { floor: daily[59].close }, taxRate: 0.05, now });
    expect(r.trend.state).toBe('down');
    expect(r.decision).not.toBe('buy');
  });

  it('backtest trên giá dao động có lãi, không nhìn trước tương lai', () => {
    const daily = mk(i => 1 + 0.25 * Math.sin(i / 4), 200);
    const bt = backtestItem({ item: 'X', daily, taxRate: 0.05 });
    expect(bt.trades).toBeGreaterThan(2);
    expect(bt.avgReturn).toBeGreaterThan(0);
    for (const t of bt.list) expect(t.sellDate > t.buyDate).toBe(true);
  });

  it('backtest lỗ thì hạ quyết định Mua xuống Chờ', () => {
    const daily = series(i => 1 + 0.3 * Math.sin(i / 3));
    const bad = { trades: 5, wins: 1, winRate: 0.2, avgReturn: -0.08, avgHoldDays: 10 };
    const r = scoreItem({ item: 'X', daily, current: { floor: 0.72, bestOffer: 0.7 }, taxRate: 0.075, now, backtest: bad });
    expect(r.decision).toBe('wait');
    expect(r.confidence).toBe('low');
  });
});

describe('vòng mùa (seasonCycle)', () => {
  const { cyclePlan, simulatePortfolio, slotOf } = require('../src-backend/domain/seasonCycle.cjs');
  const { keepTopBuys } = require('../src-backend/services/marketService.cjs');
  // Giá lặp theo vòng 28 ngày: đắt nhất giữa mùa đông (ô 24), rẻ nhất giữa mùa hè (ô 10)
  const START = Date.UTC(2025, 11, 15, 12);
  const wave = (n, amp = 0.25) => Array.from({ length: n }, (_, i) => {
    const t = START + i * DAY;
    return { date: date(t), close: Math.exp(amp * Math.cos(((slotOf(t) - 24) / 28) * 2 * Math.PI)), trades: 100, volume: 10 };
  });

  it('chưa đủ 2 vòng mùa thì không có kế hoạch', () => {
    expect(cyclePlan(wave(40), START + 40 * DAY)).toBeNull();
  });

  it('ở đáy (mùa hè) thì kỳ vọng lên, ở đỉnh (mùa đông) thì kỳ vọng xuống', () => {
    const daily = wave(200);
    const summer = daily.find((d, i) => i > 150 && slotOf(Date.parse(`${d.date}T12:00:00Z`)) === 10);
    const atLow = cyclePlan(daily, Date.parse(`${summer.date}T12:00:00Z`), { taxRate: 0.05 });
    expect(atLow.gain).toBeGreaterThan(0.3);
    expect(atLow.consistency).toBeGreaterThanOrEqual(0.7);
    const winter = daily.find((d, i) => i > 150 && slotOf(Date.parse(`${d.date}T12:00:00Z`)) === 24);
    const atHigh = cyclePlan(daily, Date.parse(`${winter.date}T12:00:00Z`), { taxRate: 0.05 });
    expect(atHigh.drop).toBeGreaterThan(0.2);
    expect(atHigh.seasonAvg.winter).toBeGreaterThan(atHigh.seasonAvg.summer);
  });

  it('scoreItem theo vòng mùa: đáy → Mua kèm ngày bán chậm nhất, đỉnh → Bán', () => {
    const daily = wave(200);
    const pick = slot => daily.filter((d, i) => i > 150 && slotOf(Date.parse(`${d.date}T12:00:00Z`)) === slot)[0];
    const low = pick(11);
    const nowLow = Date.parse(`${low.date}T12:00:00Z`);
    const upTo = daily.filter(d => d.date <= low.date);
    const buy = scoreItem({ item: 'X', daily: upTo, current: { floor: low.close }, taxRate: 0.05, now: nowLow, cycle: cyclePlan(upTo, nowLow, { taxRate: 0.05 }) });
    expect(buy.decision).toBe('buy');
    expect(buy.sellBy > low.date).toBe(true);
    expect(buy.sellTarget).toBeGreaterThan(buy.buyPrice);
    const high = pick(24);
    const nowHigh = Date.parse(`${high.date}T12:00:00Z`);
    const upTo2 = daily.filter(d => d.date <= high.date);
    const sell = scoreItem({ item: 'X', daily: upTo2, current: { floor: high.close }, taxRate: 0.05, now: nowHigh, cycle: cyclePlan(upTo2, nowHigh, { taxRate: 0.05 }) });
    expect(sell.decision).toBe('sell');
    // Quyết định theo vòng mùa: không in giá mua–bán / backtest / mùa của luật phân vị cũ (dễ đọc nhầm)
    const backtest = { trades: 5, winRate: 0.4, avgReturn: -0.1, avgHoldDays: 9 };
    const withOld = scoreItem({ item: 'X', daily: upTo2, current: { floor: high.close }, taxRate: 0.05, now: nowHigh, backtest, cycle: cyclePlan(upTo2, nowHigh, { taxRate: 0.05 }) });
    expect(withOld.reasons.some(r => r.startsWith('Backtest luật này') || / → lãi ròng /.test(r) || /hơn mùa này/.test(r))).toBe(false);
    const oldRule = scoreItem({ item: 'X', daily: upTo2, current: { floor: high.close }, taxRate: 0.05, now: nowHigh, backtest, options: { useCycle: false } });
    expect(oldRule.reasons.some(r => r.startsWith('Backtest luật này'))).toBe(true);
    expect(oldRule.reasons.some(r => / → lãi ròng /.test(r))).toBe(true);
  });

  it('backtest danh mục: có lãi, không giữ quá 28 ngày, không quá topN lệnh cùng lúc', () => {
    const r = simulatePortfolio({ A: wave(320), B: wave(320, 0.2) }, { taxRate: 0.05, topN: 1 });
    expect(r.trades).toBeGreaterThan(2);
    expect(r.avgReturn).toBeGreaterThan(0);
    for (const t of r.list) expect(t.holdDays).toBeLessThanOrEqual(28);
    const sorted = r.list.slice().sort((a, b) => (a.buyDate < b.buyDate ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].buyDate >= sorted[i - 1].sellDate).toBe(true);
  });

  it('chỉ giữ Mua cho top N', () => {
    const mkSig = (item, rank) => ({ item, decision: 'buy', reasons: [], cycleBuy: { rank } });
    const list = keepTopBuys([mkSig('a', 0.1), mkSig('b', 0.3), mkSig('c', 0.2), { item: 'd', decision: 'wait', reasons: [] }], 2);
    expect(list.filter(s => s.decision === 'buy').map(s => s.item).sort()).toEqual(['b', 'c']);
    expect(list.find(s => s.item === 'b').rank).toBe(1);
    expect(list.find(s => s.item === 'a').decision).toBe('wait');
  });
});

describe('luật bổ sung (2026-11-02)', () => {
  const { simulatePortfolio, DEFAULTS } = require('../src-backend/domain/seasonCycle.cjs');
  const { CHAPTERS } = require('../src-backend/domain/chapters.cjs');

  it('chapter Cave Dwellers bắt đầu 2026-11-02', () => {
    expect(seasons.chapterAt(Date.UTC(2026, 10, 2, 12), CHAPTERS).name).toBe('Cave Dwellers');
  });

  it('cắt lỗ mặc định tắt, bật được bằng option', () => {
    expect(DEFAULTS.stopLoss).toBeNull();
    const daily = Array.from({ length: 200 }, (_, i) => ({ date: date(Date.UTC(2025, 11, 15, 12) + i * DAY), close: 1 + 0.3 * Math.sin(i / 3), trades: 100 }));
    const r = simulatePortfolio({ A: daily }, { taxRate: 0.05, stopLoss: 0.01, minConsistency: 0, minGain: 0 });
    for (const t of r.list.filter(x => x.reason === 'stop')) expect(t.ret).toBeLessThanOrEqual(-0.01);
  });

  it('chưa đủ vòng mùa: giá rẻ nhưng đi ngang thì chỉ Chờ, không Mua', () => {
    const daily = series(i => 1 + 0.3 * Math.sin(i / 3));
    const r = scoreItem({ item: 'X', daily, current: { floor: 0.72, bestOffer: 0.7 }, taxRate: 0.075, now: NOW });
    if (r.trend.state !== 'up') expect(r.decision).not.toBe('buy');
  });
});

describe('canh đáy (mode trough)', () => {
  const { cyclePlan, slotOf, simulatePortfolio } = require('../src-backend/domain/seasonCycle.cjs');
  const START = Date.UTC(2025, 11, 15, 12);
  const wave = n => Array.from({ length: n }, (_, i) => {
    const t = START + i * DAY;
    return { date: date(t), close: Math.exp(0.25 * Math.cos(((slotOf(t) - 24) / 28) * 2 * Math.PI)), trades: 100 };
  });

  it('trước đáy vài ngày: giá mua (offer) thấp hơn giá hiện tại, đáy nằm trong tương lai, bán sau đáy', () => {
    const daily = wave(200);
    const d = daily.find((r, i) => i > 150 && slotOf(Date.parse(`${r.date}T12:00:00Z`)) === 4);
    const now = Date.parse(`${d.date}T12:00:00Z`);
    const plan = cyclePlan(daily.filter(r => r.date <= d.date), now, { taxRate: 0.05 });
    expect(plan.mode).toBe('trough');
    expect(plan.buyInDays).toBeGreaterThan(0);
    expect(plan.buyPrice).toBeLessThan(d.close);
    expect(plan.peakInDays).toBeGreaterThan(plan.buyInDays);
    expect(plan.exitInDays).toBeLessThanOrEqual(28);
    expect(plan.orderDays).toBe(plan.buyInDays + 3);
  });

  it('backtest canh đáy: mua ở giá offer hoặc rẻ hơn, có offer không khớp thì bỏ', () => {
    const r = simulatePortfolio({ A: wave(320) }, { taxRate: 0.05, topN: 1, mode: 'trough' });
    expect(r.trades).toBeGreaterThan(2);
    expect(r.avgReturn).toBeGreaterThan(0);
    expect(r.options.mode).toBe('trough');
  });
});

describe('cycleRecord', () => {
  const { cycleRecord } = require('../src-backend/domain/seasonCycle.cjs');
  it('mua ô đáy bán ô đỉnh của chu kỳ 28 ngày lặp lại thì lãi', () => {
    const start = Date.parse('2025-12-15T12:00:00Z');
    const daily = Array.from({ length: 300 }, (_, i) => ({
      date: new Date(start + i * 864e5).toISOString().slice(0, 10),
      close: 1 + 0.3 * Math.sin((2 * Math.PI * i) / 28)
    }));
    const r = cycleRecord(daily, { taxRate: 0.1 });
    expect(r.trades).toBeGreaterThanOrEqual(4);
    expect(r.winRate).toBe(1);
    expect(r.avgReturn).toBeGreaterThan(0.3);
    // Danh sách lệnh khớp với thống kê, mỗi lệnh mua trước bán
    expect(r.list).toHaveLength(r.trades);
    for (const t of r.list) {
      expect(t.buyDate < t.sellDate).toBe(true);
      expect(t.ret).toBeCloseTo(t.sell * 0.9 / t.buy - 1);
    }
    expect(Math.min(...r.list.map(t => t.ret))).toBe(r.worst);
  });
  it('mua ở ô đáy mà dữ liệu chưa tới ô đỉnh thì là lệnh đang mở, không tính vào thành tích', () => {
    const start = Date.parse('2025-12-15T12:00:00Z');
    const full = Array.from({ length: 300 }, (_, i) => ({
      date: new Date(start + i * 864e5).toISOString().slice(0, 10),
      close: 1 + 0.3 * Math.sin((2 * Math.PI * i) / 28)
    }));
    const r = cycleRecord(full, { taxRate: 0.1 });
    const t = r.list[r.list.length - 2];
    // Cắt dữ liệu 2 ngày sau ngày mua của 1 lệnh (chưa tới ngày bán): lệnh đó thành lệnh đang mở
    const cutAt = full.findIndex(d => d.date === t.buyDate) + 3;
    const partial = cycleRecord(full.slice(0, cutAt), { taxRate: 0.1 });
    expect(partial.open).toEqual({ buyDate: t.buyDate, buy: t.buy });
    expect(partial.trades).toBe(r.list.length - 2);
    expect(partial.list).toEqual(r.list.slice(0, -2));
  });
  it('giá đi ngang thì không lãi', () => {
    const start = Date.parse('2025-12-15T12:00:00Z');
    const daily = Array.from({ length: 300 }, (_, i) => ({ date: new Date(start + i * 864e5).toISOString().slice(0, 10), close: 1 }));
    const r = cycleRecord(daily, { taxRate: 0.1 });
    expect(r.avgReturn == null || r.avgReturn < 0).toBe(true);
  });
});
