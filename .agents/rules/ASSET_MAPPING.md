# Lấy ảnh NFT và Wearables trong Sunflower Land

Khi làm việc với các file ảnh của Sunflower Land (đặc biệt là Wearables/NFTs), cần lưu ý các quy tắc sau để tránh lỗi mất ảnh (hình `?`):

## Vấn đề
Mã nguồn gốc của Sunflower Land (`d:\sunflower-land\src\assets\wearables`) **không** lưu trữ ảnh wearables dưới dạng tên gọi thông thường (ví dụ: `rice_shirt.png` hay `Rice Shirt.webp`). Thay vào đó, tất cả wearables được đánh chỉ mục bằng **ID dạng số** (ví dụ: `413.webp`).

Nếu Frontend (UI) chỉ gọi ảnh thông qua thuộc tính tên món đồ (ví dụ: `itemImg: "Rice Shirt"`), nó sẽ không bao giờ tìm thấy file ảnh tương ứng.

## Giải pháp (Đã triển khai trong `assetsController.cjs`)
Để Backend có thể phục vụ ảnh wearables từ SFL repo mà không cần sửa đổi quá nhiều ở Frontend:
1. SFL lưu trữ ánh xạ (mapping) giữa tên Wearable và ID tại file mã nguồn TypeScript: `src/features/game/types/bumpkin.ts` (ở biến `ITEM_IDS`).
2. Trong `assetsController.cjs`, khi quét thư mục `assets` để xây dựng `assetsMap`, ta tự động đọc và parse file `bumpkin.ts` này.
3. Trích xuất block `ITEM_IDS` và tạo các Alias (tên ảo) trong bộ nhớ.
   Ví dụ: Backend tự động hiểu `map['riceshirt'] = map['413'] = '/sfl-assets/wearables/413.webp'`.
4. Nhờ đó, Frontend chỉ cần truyền tên `Rice Shirt`, logic tự động sẽ phân giải ra đường dẫn tĩnh hợp lệ.

**QUY TẮC CẦN NHỚ CHO TƯƠNG LAI:**
- **Tuyệt đối không** hardcode (fix cứng) các ID của NFTs vào Frontend hay Backend trừ khi thực sự cần thiết, vì game liên tục thêm mới.
- Hãy dựa vào bộ sinh (parser) tự động từ `bumpkin.ts` trong `assetsController.cjs`. Nếu API trả về một loại NFT mới và bị mất ảnh, hãy kiểm tra xem NFT đó đã được cập nhật trong `bumpkin.ts` và thư mục `assets` ở repo SFL cục bộ hay chưa. (Nếu chưa, người dùng cần pull code SFL mới nhất).
- **Không** dựa vào các CDN bên thứ ba (như `sunflowermanager.xyz` hoặc `sfl.world`) trừ khi không còn cách nào khác (ví dụ: repo SFL cục bộ không có ảnh đó). Các CDN này thường có cơ chế chặn bằng Cloudflare.
