# Báo cáo FLIP (dùng cá nhân)

Lãi/lỗ lướt sóng trên marketplace, ghép lô mua - bán theo FIFO. Chỉ chủ farm xem được.

## Bật trên máy của bạn

Thêm vào `.env` (không commit file này):

```
FLIP_ENABLED=true
FLIP_OWNER_KEY=<mã bí mật>
FLIP_FARM_IDS=<farm id của bạn>
FLIP_SYNC_INTERVAL_SECONDS=60
FLIP_FAST_INTERVAL_SECONDS=10
FLIP_BURST_THRESHOLD=10
FLIP_TZ_OFFSET_MINUTES=420
```

Tạo mã: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`

Trên bản deploy công khai để `FLIP_ENABLED=false` hoặc bỏ trống: `/api/flip` sẽ không tồn tại.

Khi bật, server tự lưu giao dịch của các farm trong `FLIP_FARM_IDS`.
Lệnh bán vừa khớp được ghi kèm mức thuế lúc đó (`taxRateAtTrade`); lệnh cũ tính theo thuế hiện tại.

## Không để sót giao dịch

API marketplaceProfile chỉ trả 50 giao dịch gần nhất, không phân trang được.

- **Nhịp tự động:** bình thường lấy 60 giây một lần. Một lượt có từ `FLIP_BURST_THRESHOLD` lệnh mới,
  hoặc có lệnh vừa khớp trong 1 phút, thì chuyển sang 10 giây một lần; 3 lượt liên tiếp không có lệnh mới thì về lại 60 giây.
- **Nút "Đang gom hàng"** trong panel: chạy nhịp 10 giây ngay trong 10 phút, bấm trước khi gom.
- **Tự nhường:** có người dùng đang chờ trong hàng đợi API thì lượt lấy giao dịch lùi lại 3 giây.
  Lượt lấy giao dịch vẫn chạy trước các tác vụ nền (tải đấu giá cũ...).
- **Phát hiện sót:** cả 50 lệnh trả về đều mới (không chồng lên lệnh đã lưu) thì ghi một "khoảng sót" (`flip_gaps`);
  số lệnh sót tính từ `totalTrades` của API.
- **Tự bù:** mỗi lượt chụp kho đồ và số dư FLOWER (`flip_snapshots`, giữ 14 ngày). Với mỗi khoảng sót,
  so ảnh chụp trước và sau: số lượng thiếu của từng món lấy từ kho đồ, tiền thiếu lấy từ số dư; nhiều món thì chia
  tiền theo giá trung bình các lệnh cùng đợt (hoặc giá thị trường). Tiền lệch quá xa giá tham chiếu, hoặc số dư không
  khớp (ví dụ kho tăng do thu hoạch), thì không tự bù mà chỉ cảnh báo. Lệnh bù được đánh dấu "Ước tính".
- **Nhập tay:** mục "Lệnh bù & nhập tay" trong panel để thêm/sửa/xoá lệnh. Nhập giá mỗi cái; hệ thống tự tính tổng SFL
  (số lượng × giá) và tự trừ thuế với lệnh bán.
- **Cột "Đang giữ":** lấy số lượng thật trong kho đồ (API inventory), dòng phụ là phần còn lại của các lô đã mua.

## Xem trong app

Mở app với `#flip` ở cuối địa chỉ (ví dụ `http://localhost:5173/#flip`), vào tab Lịch sử Giao Dịch,
nhập mã một lần. Trình duyệt nhớ mã; bấm "Khoá" để quên. Không có mã thì panel không hiện.

## File Excel tự làm mới

Server phải đang chạy. Rồi nhấp đúp `scripts\flip\New-FlipWorkbook.bat` (hoặc gõ đường dẫn file .bat trong cmd), hoặc chạy trong thư mục project:

```
powershell -ExecutionPolicy Bypass -File scripts\flip\New-FlipWorkbook.ps1
```

Mặc định tạo `Documents\SFL-FLIP.xlsx`, đọc mã và farm từ `.env`, lấy dữ liệu từ `http://localhost:3001`.
Tham số: `-ApiUrl`, `-FarmId`, `-Category resource|nft|all`, `-RefreshMinutes`, `-OutPath`.

File có sheet tổng quan (công thức + biểu đồ), Resources, Lots, Daily, Holding, NonFlip.
Dữ liệu tự làm mới mỗi phút và khi mở file. Mã được lưu trong file, đừng gửi file cho người khác.

## API

Tất cả cần header `x-flip-key`. Sai mã hoặc farm không thuộc `FLIP_FARM_IDS` thì trả 404.

- `GET /api/flip/status`
- `POST /api/flip/sync`
- `GET /api/flip/:farmId?category=resource|nft|all&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/flip/:farmId/{summary|resources|lots|daily|openLots|nonFlip|adjustments|gaps}`
- `POST /api/flip/:farmId/burst` (`{ "minutes": 10 }`), `DELETE /api/flip/:farmId/burst`
- `POST /api/flip/:farmId/adjustments`, `PATCH|DELETE /api/flip/:farmId/adjustments/:id`
  (`{ item, side: "buy"|"sell", qty, price, at, note }`, price là giá mỗi cái, bán là giá trước thuế)

## Chạy trên Render (không cần máy local)

1. Merge branch vào nhánh Render đang deploy.
2. Trong Render > service backend > Environment, thêm `FLIP_ENABLED=true`, `FLIP_OWNER_KEY`,
   `FLIP_FARM_IDS`, `FLIP_TZ_OFFSET_MINUTES` (cùng giá trị như `.env`); các biến nhịp lấy giao dịch có giá trị mặc định.
3. Server trên Render tự lưu giao dịch vào MongoDB; máy local không cần chạy.
   Gói Free của Render ngủ sau 15 phút không có request, lúc đó cron dừng: dùng cron-job.org
   gọi `/api/ping` mỗi 10 phút, hoặc dùng gói trả phí.
4. Tạo lại file Excel trỏ vào Render: `New-FlipWorkbook.bat -ApiUrl https://<tên-service>.onrender.com`.
