/**
 * Lịch mùa của Sunflower Land (hàm thuần, không gọi DB hay API).
 *
 * Mùa (temperate season) xoay THEO TUẦN: tuần bắt đầu thứ Hai 00:00 UTC,
 * thứ tự spring → summer → autumn → winter, mốc đầu tiên 2024-12-16 (spring).
 * Nguồn: sunflower-land/src/features/game/lib/season.ts
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const FIRST_WEEK_START_AT = Date.UTC(2024, 11, 16);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const SEASON_LABELS = {
  spring: 'Mùa xuân',
  summer: 'Mùa hè',
  autumn: 'Mùa thu',
  winter: 'Mùa đông'
};

// Cây trồng/trái cây/nhà kính trồng được theo mùa (bỏ hoa vì hoa không bán trên chợ tài nguyên).
// Nguồn: SEASONAL_SEEDS trong sunflower-land/src/features/game/types/seeds.ts
const SEASONAL_CROPS = {
  spring: ['Sunflower', 'Rhubarb', 'Carrot', 'Cabbage', 'Soybean', 'Corn', 'Wheat', 'Kale', 'Barley', 'Tomato', 'Blueberry', 'Orange', 'Rice', 'Olive', 'Grape'],
  summer: ['Sunflower', 'Potato', 'Zucchini', 'Pepper', 'Beetroot', 'Cauliflower', 'Eggplant', 'Radish', 'Wheat', 'Lemon', 'Orange', 'Banana', 'Rice', 'Olive', 'Grape'],
  autumn: ['Potato', 'Pumpkin', 'Carrot', 'Yam', 'Broccoli', 'Soybean', 'Wheat', 'Barley', 'Artichoke', 'Tomato', 'Apple', 'Banana', 'Rice', 'Olive', 'Grape'],
  winter: ['Potato', 'Cabbage', 'Beetroot', 'Cauliflower', 'Parsnip', 'Onion', 'Turnip', 'Wheat', 'Kale', 'Lemon', 'Blueberry', 'Apple', 'Rice', 'Olive', 'Grape']
};

// Nguyên liệu Lava Pit (ra Obsidian) theo mùa, bản áp dụng từ 2025-11-10.
// Nguồn: LAVA_PIT_REQUIREMENTS_NEW trong sunflower-land/src/features/game/events/landExpansion/startLavaPit.ts
const LAVA_PIT_REQUIREMENTS = {
  autumn: { Artichoke: 30, Broccoli: 750, Yam: 1000, Gold: 5, Crimstone: 6 },
  winter: { 'Merino Wool': 150, Onion: 400, Turnip: 200, Crimstone: 5 },
  spring: { Celestine: 2, Lunara: 2, Duskberry: 2, Rhubarb: 2000, Crimstone: 10 },
  summer: { Oil: 70, Pepper: 750, Zucchini: 1000, Crimstone: 4 }
};

function weekIndexAt(ts) {
  return Math.max(Math.floor((ts - FIRST_WEEK_START_AT) / WEEK_MS), 0);
}

/**
 * Mùa tại thời điểm ts (ms)
 * @returns {{ season: string, startedAt: number, endsAt: number, weekIndex: number }}
 */
function seasonAt(ts = Date.now()) {
  const weekIndex = weekIndexAt(ts);
  const startedAt = FIRST_WEEK_START_AT + weekIndex * WEEK_MS;
  return { season: SEASONS[weekIndex % 4], startedAt, endsAt: startedAt + WEEK_MS, weekIndex };
}

/**
 * Dải mùa phủ khoảng [from, to] (để tô nền biểu đồ)
 */
function seasonBands(from, to) {
  const bands = [];
  let cursor = seasonAt(from).startedAt;
  while (cursor < to) {
    const s = seasonAt(cursor);
    bands.push({ season: s.season, from: Math.max(s.startedAt, from), to: Math.min(s.endsAt, to) });
    cursor = s.endsAt;
  }
  return bands;
}

/**
 * Mùa hiện tại và n mùa kế tiếp
 */
function upcomingSeasons(ts = Date.now(), count = 4) {
  const now = seasonAt(ts);
  return Array.from({ length: count }, (_, i) => seasonAt(now.startedAt + i * WEEK_MS));
}

/** Các mùa trồng được một vật phẩm (rỗng = không phải cây theo mùa) */
function seasonsForItem(item) {
  return SEASONS.filter(s => SEASONAL_CROPS[s].includes(item));
}

/** Chỉ trồng được trong đúng 1 mùa: chu kỳ giá thường rõ nhất */
function isSingleSeasonCrop(item) {
  return seasonsForItem(item).length === 1;
}

/**
 * Chapter tại thời điểm ts và tuần thứ mấy trong chapter (tính từ 1).
 * chapters: { [tên]: { startDate, endDate } } (ms). Chưa khai báo chapter mới thì coi như
 * chapter "chưa đặt tên" bắt đầu từ endDate của chapter cuối.
 */
function chapterAt(ts, chapters) {
  const list = Object.entries(chapters || {})
    .map(([name, t]) => ({ name, startDate: Number(t.startDate), endDate: Number(t.endDate) }))
    .sort((a, b) => a.startDate - b.startDate);
  let found = list.find(c => ts >= c.startDate && ts < c.endDate);
  if (!found && list.length && ts >= list[list.length - 1].endDate) {
    found = { name: null, startDate: list[list.length - 1].endDate, endDate: null };
  }
  if (!found) return { name: null, startDate: null, endDate: null, week: null };
  return { ...found, week: Math.floor((ts - found.startDate) / WEEK_MS) + 1 };
}

module.exports = {
  DAY_MS,
  WEEK_MS,
  SEASONS,
  SEASON_LABELS,
  SEASONAL_CROPS,
  LAVA_PIT_REQUIREMENTS,
  seasonAt,
  seasonBands,
  upcomingSeasons,
  seasonsForItem,
  isSingleSeasonCrop,
  chapterAt
};
