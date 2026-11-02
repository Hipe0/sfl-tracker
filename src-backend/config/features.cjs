/**
 * Bật/tắt các phần của hệ thống. Hiện app chỉ chạy FLIP; code các tính năng cũ
 * (deliveries, chores, đấu giá, theo dõi farm...) vẫn giữ nguyên, chỉ không chạy job nền.
 * Muốn bật lại: đặt FEATURE_LEGACY=true trong .env (và bật legacy ở src/config/features.js cho giao diện).
 */
module.exports = {
  legacy: process.env.FEATURE_LEGACY === 'true',
  market: process.env.FEATURE_MARKET !== 'false'
};
