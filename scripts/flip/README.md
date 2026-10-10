# Báo cáo FLIP (dùng cá nhân)

Lãi/lỗ lướt sóng trên marketplace, ghép lô mua - bán theo FIFO. Chỉ chủ farm xem được.

## Bật trên máy của bạn

Thêm vào `.env` (không commit file này):

```
FLIP_ENABLED=true
FLIP_OWNER_KEY=<mã bí mật>
FLIP_FARM_IDS=<farm id của bạn>
FLIP_SYNC_CRON=*/2 * * * *
FLIP_TZ_OFFSET_MINUTES=420
```

Tạo mã: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`

Trên bản deploy công khai để `FLIP_ENABLED=false` hoặc bỏ trống: `/api/flip` sẽ không tồn tại.

Khi bật, server tự lưu giao dịch của các farm trong `FLIP_FARM_IDS` theo `FLIP_SYNC_CRON`
(API marketplaceProfile chỉ trả 50 giao dịch gần nhất, nên cần chạy đều để không sót).
Lệnh bán vừa khớp được ghi kèm mức thuế lúc đó (`taxRateAtTrade`); lệnh cũ tính theo thuế hiện tại.

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
- `GET /api/flip/:farmId/{summary|resources|lots|daily|openLots|nonFlip}`
