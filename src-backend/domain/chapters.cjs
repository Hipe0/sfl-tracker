/**
 * Mốc chapter (UTC). Chapter mới bắt đầu thì thêm một dòng ở đây (xem
 * sunflower-land/src/features/game/types/chapters.ts). Chưa thêm thì hệ thống vẫn chạy,
 * chỉ hiện "chapter mới" và đếm tuần từ ngày kết thúc chapter cuối.
 */
const CHAPTERS = {
  'Better Together': { startDate: Date.UTC(2025, 7, 4), endDate: Date.UTC(2025, 10, 3) },
  'Paw Prints': { startDate: Date.UTC(2025, 10, 3), endDate: Date.UTC(2026, 1, 2) },
  'Crabs and Traps': { startDate: Date.UTC(2026, 1, 2), endDate: Date.UTC(2026, 4, 4) },
  'Salt Awakening': { startDate: Date.UTC(2026, 4, 4), endDate: Date.UTC(2026, 7, 3) },
  'Ascension Age': { startDate: Date.UTC(2026, 7, 3), endDate: Date.UTC(2026, 10, 2) },
  'Cave Dwellers': { startDate: Date.UTC(2026, 10, 2), endDate: Date.UTC(2027, 1, 1) }
};

module.exports = { CHAPTERS };
