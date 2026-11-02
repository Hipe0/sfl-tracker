/**
 * Lấp tay các ngày giá còn thiếu trong DB bằng API game (marketplaceActivity&date=).
 * Server bình thường KHÔNG tự chạy việc này nữa (chỉ gọi API 15 phút/lần lấy giá).
 *
 *   npm run market:backfill            # lấp tối đa MARKET_BACKFILL_DAYS ngày (mặc định 330)
 *   npm run market:backfill -- 30      # chỉ xét 30 ngày gần nhất
 *
 * Nên chạy lúc server đang tắt, hoặc chấp nhận chia rate limit với server (~1 request / 5 giây mỗi IP).
 */
require('dotenv').config();
const { initDB } = require('../src-backend/config/db.cjs');

(async () => {
  if (!process.env.SFL_API_KEY) {
    console.error('Thiếu SFL_API_KEY trong .env');
    process.exit(1);
  }
  await initDB();
  const { backfill, getStatus } = require('../src-backend/jobs/marketCollector.cjs');
  const days = Number(process.argv[2]) || undefined;
  await backfill(days);
  const s = getStatus().backfill || {};
  console.log(`Xong: lấp ${s.done ?? 0}/${s.total ?? 0} ngày${s.failed?.length ? `, lỗi ${s.failed.length} ngày: ${s.failed.join(', ')} (chạy lại lệnh này để thử lại)` : ''}`);
  process.exit(0);
})().catch(e => {
  console.error('Lỗi:', e.message);
  process.exit(1);
});
