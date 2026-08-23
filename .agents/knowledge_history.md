# SFL Tracker - Lịch sử Tái cấu trúc Hệ thống (Knowledge Item)

Tệp này lưu trữ lịch sử những thay đổi và quyết định kiến trúc quan trọng do trợ lý AI (Antigravity) thực hiện, giúp các trợ lý AI trong tương lai hoặc người lập trình hiểu rõ bối cảnh dự án.

## 1. Giai đoạn 1: Gỡ bỏ kịch bản Scraping (`cheerio`) & Sửa lỗi Rate Limit
- **Thời gian thực hiện:** 23/08/2026 14:13
- **Vấn đề cũ:** File `farmRoutes.cjs` sử dụng `cheerio` để cào (scrape) 3 trang HTML (`/land`, `/chapter`, `/boost`) từ sfl.world, gây ra lỗi Rate Limit nghiêm trọng (429) và làm chậm API (chờ >4 giây).
- **Giải pháp đã triển khai:**
  - **Chặn hoàn toàn `cheerio`**: Bỏ thư viện parse HTML.
  - **Sử dụng trực tiếp JSON API**: Gọi fetch qua endpoint `https://api.sunflower-land.com/community/farms/`.
  - **Tính toán logic Level**: Viết lại hàm `getTotalBumpkinLevel` (trong `src-backend/utils/levelCalculator.cjs`) mô phỏng 100% logic mã nguồn game để quy đổi điểm kinh nghiệm (XP) thành Cấp độ, xét cả yếu tố Thăng hoa (Ascension).
  - **Xử lý hòm & cày sa mạc**: Đọc trực tiếp từ `farm.dailyChest` và `farm.desertDigging` của API (đếm grid và so sánh collectedAt) để biết đã hoàn thành nhiệm vụ hay chưa.

## 2. Giai đoạn 2: Tái cấu trúc MVC & In-Memory Cache
- **Vấn đề cũ:** File `farmRoutes.cjs` là một khối monolith dài hơn 1300 dòng, chứa tất cả logic gửi nhận mạng, tính giá và định tuyến (Routing), rất khó bảo trì.
- **Giải pháp đã triển khai:**
  - **Dọn dẹp (Root Directory Cleanup):** Chuyển hơn 40 tệp scripts chạy tạm (debug, check...) vào `scripts/`. Các tệp AI như `AGENTS.md`, `ALGORITHM_RULES.md` được tập trung vào `.agents/rules/`.
  - **Áp dụng MVC:**
    - `src-backend/routes/farmRoutes.cjs`: Chỉ còn chứa cấu hình endpoint định tuyến (Router).
    - `src-backend/controllers/farmController.cjs`: Trở thành trung tâm xử lý Request, tính toán phần thưởng, tính chi phí.
    - `src-backend/services/sflApiService.cjs`: Xử lý độc lập mọi tương tác lấy dữ liệu mạng.
  - **Bộ nhớ đệm (In-Memory Cache):** 
    - Cài đặt thư viện `node-cache`.
    - Dữ liệu `gameData` (SFL API) và `marketPrices` (sfl.world) được lưu trên RAM trong 180 giây.
    - Ngăn chặn hoàn toàn việc spam 429 Rate Limit khi người dùng liên tục bấm refresh trang. Tốc độ load cải thiện từ >3.9 giây xuống ~0.6 giây.

## Hướng dẫn cho AI Agents tương lai
1. **Quy tắc (Rules):** Luôn tuân theo `ALGORITHM_RULES.md` khi tính toán Level/Ticket.
2. **Kiến trúc mới:** Mọi logic lấy dữ liệu mới phải được thêm vào `sflApiService.cjs`. Logic tính toán phải nằm trong `farmController.cjs` (sắp tới có thể tách tiếp thành `farmLogicService.cjs`).
3. **KHÔNG** dùng HTML scraping lại nữa. Luôn tìm kiếm giải pháp phân tích JSON.
