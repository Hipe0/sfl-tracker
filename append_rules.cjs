const fs = require('fs');
const content = `

## 21. Lọc Cứng Nhiệm Vụ Bounties & Animals (Absolute Ticket Filtering)
- **Cấu trúc JSON Phần Thưởng:** Khác với Chores (phần thưởng nằm trong object \`reward.items\`), phần thưởng của Bounties & Animals nằm ngay trên mảng cấp cao nhất dưới dạng \`req.items\` hoặc \`req.coins\`.
- **Mục Đích Hiển Thị:** Bảng Overview (Dashboard) CHỈ được phép hiển thị các nhiệm vụ trả thưởng bằng vé sự kiện (\`Shiny Feather\` đối với Ascension Age).
- **Hành động BẮT BUỘC (Absolute Filter):** Trong vòng lặp \`bounties.requests\`, ngay sau khi xác định được \`rewardType\` (từ \`req.items\`, \`req.coins\`, \`req.sfl\`), thuật toán BẮT BUỘC phải thực hiện kiểm tra loại trừ cứng: \`if (rewardType !== 'Shiny Feather') return;\`
- Lệnh này giúp loại bỏ hoàn toàn (drop) mọi nhiệm vụ trả về Coins, Gems, Thức ăn... ra khỏi mảng hiển thị. Đảm bảo tổng phần thưởng (\`Tổng Tickets\`) ở Frontend sẽ không bao giờ bị cộng dồn rác.

## 22. Tối Ưu Hóa Cron Job (Background Scanner & Rate Limit)
- **Vấn đề Rate Limit (Lỗi 429):** Khi Cron Job (lịch tự động quét lúc 6:40 AM) lặp qua danh sách toàn bộ ID nông trại trong Database, vòng lặp chạy quá nhanh sẽ kích hoạt hệ thống chống Spam của SFL.
- **Hành động BẮT BUỘC 1 (Nghỉ ngơi):** Bắt buộc phải thêm cơ chế \`await sleep(5000)\` (Dừng 5 giây) ở cuối mỗi vòng lặp trong file cấu hình Cron (\`dailyReset.cjs\` hoặc \`/api/cron\`) để tránh ăn gậy 429 Rate Limit.
- **Vấn đề Cổ Chai Thời Gian (Bottleneck):** Hành động lấy giá P2P qua \`sfl.world\` luôn đi kèm với hàm \`update\` bắt buộc phải \`sleep 3.5s\` chờ Cache xử lý, khiến mỗi Farm mất gần 8 giây để quét xong.
- **Hành động BẮT BUỘC 2 (Bỏ qua P2P khi Cron):** Mục đích duy nhất của Cron là **Chốt sổ Lịch sử giao hàng** (Đếm \`deliveryCount\` và ghi nhận Diff > 0 dựa trên giá trị đã lưu đệm từ hôm qua). Vì vậy, Backend BẮT BUỘC phải truyền cờ \`?cron=true\` vào URL khi Cron kích hoạt. Nếu Backend đọc được \`req.query.cron === 'true'\`, hệ thống phải BỎ QUA hoàn toàn block code gọi \`sfl.world/update\`, giúp giảm thời gian quét từ 8 giây xuống còn 0.5 giây / 1 Nông trại. Dữ liệu P2P cũ vẫn được duy trì an toàn bằng History Logic.
`;
fs.appendFileSync('d:/sunflower-land/sfl-tracker/ALGORITHM_RULES.md', content, 'utf8');
console.log('Appended successfully');
