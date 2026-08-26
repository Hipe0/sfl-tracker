# Phân tích Sunflower Land Community API & Tiềm năng phát triển

Dựa trên tài liệu chính thức từ [Sunflower Land Community Docs](https://sunflower-land.com/community-docs/#/), dưới đây là danh sách toàn bộ các API cộng đồng đang được cung cấp, hiện trạng áp dụng trong dự án `sfl-tracker` của chúng ta, và những tính năng mới có thể phát triển thêm.

---

## 1. Các API đang được cung cấp & Hiện trạng áp dụng

Tài liệu chính thức liệt kê 6 API chính (đều là phương thức GET - chỉ đọc dữ liệu):

| Endpoint API | Mục đích chính | Tình trạng áp dụng trong SFL Tracker |
| :--- | :--- | :--- |
| **`GET /community/farms/{id}`** | Lấy toàn bộ dữ liệu (inventory, resources, XP, áo quần, lịch sử...) của 1 trang trại thông qua ID hoặc địa chỉ ví. | ✅ **Đã áp dụng toàn diện.** Dùng để tải dữ liệu cho các tính năng: Overview, Deliveries, Crafting Costs, Crop to Coin. |
| **`GET /community/data?type=auctions`** | Lấy danh sách toàn bộ các đợt đấu giá (quá khứ, hiện tại, tương lai), thời gian, chi phí nguyên liệu và tổng nguồn cung. | ✅ **Đã áp dụng.** Dùng để hiển thị danh sách đấu giá trong tab Live Auctions & Chapter 15. |
| **`GET /community/data?type=auctionResults`** | Lấy kết quả của một đợt đấu giá đã kết thúc: bảng xếp hạng Leaderboard (danh sách người thắng/thua), số lượng người tham gia, số lượng bid. | ✅ **Đã áp dụng.** Dùng để tải chi tiết lịch sử đấu giá, tự động đồng bộ ngầm và xem ai đã trúng thầu. |
| **`GET /community/data?type=marketplaceActivity`** | Lấy báo cáo giao dịch chợ đen hàng ngày: tổng volume, số lượng giao dịch, và giá chi tiết (thấp, cao, giá chốt) của từng vật phẩm bằng FLOWER. | ⚠️ **Áp dụng một phần.** Hiện tại ta chỉ mới gọi API này để lấy tỷ giá quy đổi `FLOWER -> USD`. Phần dữ liệu khổng lồ về giá từng vật phẩm bị bỏ qua. |
| **`GET /community/farms`** | Quét (phân trang) danh sách hàng ngàn trang trại trong game (lấy nhiều farm cùng lúc). | ❌ **Chưa áp dụng.** (Do tool hiện tại chỉ tập trung track cá nhân). |
| **`GET community.sunflower-land.com/index.json`** | Tải nguyên khối dữ liệu (Dump) của toàn bộ database game (hàng trăm nghìn farm) cập nhật mỗi đêm dưới dạng file nén. | ❌ **Chưa áp dụng.** |

---

## 2. Tiềm năng mở rộng: Ta có thể làm thêm những gì?

Với khối lượng dữ liệu khổng lồ từ các API trên (đặc biệt là dữ liệu ta chưa khai thác hết), dự án có thể mở rộng thêm các tính năng rất "xịn" sau đây:

### 🌟 Ý tưởng 1: Bảng điều khiển Thị trường (Marketplace Analytics)
- **Nguồn dữ liệu:** `type=marketplaceActivity`
- **Chi tiết:** Hiện tại ta đang bỏ lãng phí toàn bộ dữ liệu giá của các vật phẩm trong ngày. Ta có thể tạo một Tab **"Thị Trường" (Market)** để hiển thị:
  - **Top Trending:** Vật phẩm nào đang được giao dịch nhiều nhất trong ngày.
  - **Arbitrage (Cơ hội ăn chênh lệch):** Backend tự động so sánh chi phí craft (từ Tab Crafting Costs) với Giá đang bán trên Marketplace. Nếu chế đồ rẻ hơn mua trên chợ, tool sẽ đánh dấu "Nên Craft để bán"!
  - **Biểu đồ giá:** Lưu lại lịch sử giá hàng ngày để vẽ biểu đồ biến động giá của một vật phẩm (ví dụ: Gỗ đang tăng giá hay giảm giá).

### 🌟 Ý tưởng 2: Bảng Xếp Hạng Người Chơi (Global Leaderboard)
- **Nguồn dữ liệu:** `GET /community/farms` hoặc **Nightly Farm Dump**.
- **Chi tiết:** Thay vì chỉ xem farm của mình, ta có thể cào dữ liệu của hàng ngàn farm khác để xây dựng tính năng Xếp hạng.
  - **Top Nông Dân:** Ai có level (XP) cao nhất game?
  - **Top Phú Hào:** Ai đang giữ nhiều Coin / SFL nhất?
  - **Cá Voi (Whale Tracker):** Theo dõi các ví đang gom một loại vật liệu cụ thể (ví dụ: ai đang giữ nhiều Gỗ nhất chuẩn bị cho event).
  - So sánh trực tiếp farm của người dùng với Top 100 người chơi.

### 🌟 Ý tưởng 3: Lịch Drop Đấu Giá Trực Quan & Cảnh Báo
- **Nguồn dữ liệu:** `type=auctions`
- **Chi tiết:** 
  - Hiển thị danh sách đấu giá dưới dạng một **Bộ Lịch (Calendar)** trực quan.
  - Thêm tính năng **Ghim/Theo dõi (Pin)** một đợt đấu giá sắp tới. Nếu chạy tool trên máy tính cá nhân, ta có thể tích hợp Webhook để nó tự động "ting ting" hoặc gửi tin nhắn báo về Discord/Telegram của bạn trước khi phiên đấu giá bắt đầu 30 phút.

### 🌟 Ý tưởng 4: Phân tích Tăng trưởng (Growth Tracker / Net Worth)
- **Nguồn dữ liệu:** Dùng `GET /community/farms/{id}` kết hợp với Database cục bộ của SFL Tracker.
- **Chi tiết:** Mỗi ngày khi bạn mở SFL Tracker, tool sẽ tự động chụp lại một "bức ảnh" (snapshot) về kho đồ của bạn.
  - Cung cấp biểu đồ **Net Worth (Tổng tài sản tính bằng USD)**.
  - Báo cáo: "Hôm nay bạn kiếm được +2000 Coins, +50 Gỗ, tiêu mất -10 SFL". Tính năng này giống như một bản sao kê ngân hàng cực kỳ chuyên nghiệp dành riêng cho nông trại của bạn.
