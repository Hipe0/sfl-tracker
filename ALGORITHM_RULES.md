# QUY LUẬT THUẬT TOÁN BẮT BUỘC (MANDATORY ALGORITHM RULES)

> **CẢNH BÁO CHO TẤT CẢ CÁC AGENT & LẬP TRÌNH VIÊN:**
> Đọc kỹ file này **TRƯỚC KHI** thực hiện bất kỳ thay đổi nào liên quan đến logic của dự án (đặc biệt là trong file `farmRoutes.cjs`). File này định nghĩa các quy tắc cứng (hardcoded rules) không được phép ghi đè hay thay đổi trừ khi User yêu cầu rõ ràng. Việc vi phạm các quy tắc này sẽ làm hỏng dữ liệu hệ thống.

---

## 1. Hệ Thống Buff (Phải Áp dụng Ở mọi nơi nếu là Shiny Feather)
Các logic dưới đây chỉ được áp dụng khi `rewardType === 'Shiny Feather'`.

### A. Quần Áo (Clothes Buff / 3 NFT cơ bản)
- **Quy tắc:** Kiểm tra `inventory.hasHat`, `inventory.hasArmor`, `inventory.hasPants`. Mỗi món đồ cộng thêm **+1 vé** (Tối đa +3).
- **Phạm vi Áp dụng BẮT BUỘC:**
  - **TẤT CẢ Animals** (Bao gồm Chicken, Cow, Sheep).
  - **Bounties (Bảng nhiệm vụ)**.
  - **Weekly Chores (Nhiệm vụ tuần)**.
- *Lưu ý:* Không Áp dụng cho Delivery for Tickets và Delivery dùng danh sách cố định (xem mục 2).

### B. VIP Buff
- **Quy tắc:** Kiểm tra `inventory.hasVip`. Nếu có, cộng thêm **+2 vé**.
- **Phạm vi Áp dụng BẮT BUỘC:**
  - **Weekly Chores (Nhiệm vụ tuần)**.

### C. Poppy Bounty Bonus
- **Quy tắc:** Kiểm tra nếu tồn tại `summary.poppyBounty` và trạng thái `!== 'danger'`. Nếu có, cộng thêm **+100 vé**.
- **Phạm vi Áp dụng BẮT BUỘC:**
  - **Bounties (Weekly Chores)**.

---

## 2. Giao Hàng Vé (Delivery for Tickets)
Dữ liệu trên web thường bị sai hoặc lỗi số. Tuyệt đối **KHÔNG SỬ DỤNG** số lượng vé cào (scrape) từ giao diện web.

- **Quy tắc 1 (Lọc tên vật phẩm):** Phải sử dụng biểu thức chính quy (Regex) `^[a-zA-Z\s'-]+` để tách riêng chữ ra khỏi số (VD: `Pumpkin15` phải bóc tách thành `Pumpkin`).
- **Quy tắc 2 (Số vé cố định):** Sử dụng danh sách cứng (hardcoded object) dưới đây để quyết định số lượng vé:
  ```javascript
  const fixedFeathers = { 
    "pumpkin' pete": 6, 
    "bert": 7, 
    "miranda": 7, 
    "finley": 7, 
    "raven": 9, 
    "finn": 10, 
    "timmy": 10, 
    "cornwell": 8, 
    "jester": 9, 
    "pharaoh": 11, 
    "tywin": 15 
  };
  ```
- *Lưu ý:* Không cộng thêm bất kỳ buff quần áo hay VIP nào vào phần giao hàng này.

---

## 3. Quét API Bounties & Animals
Dữ liệu hiển thị vé trên Web UI không đáng tin cậy hoặc BỊ ẨN. Phải luôn sử dụng `gameData.bounties.requests` từ SFL API.

- **Animals:** Giao diện SFL.world hiện tại ĐÃ ẨN hoàn toàn mục Animals (HTML rỗng). **BẮT BUỘC** phải build mảng `animals` 100% bằng cách lặp qua `gameData.bounties.requests`, tìm các nhiệm vụ chứa từ khóa `cow`, `sheep`, `chicken`.
    - **Phân loại Task Animal:** BẮT BUỘC phải xác định rõ task nào trả về Coins, task nào trả về Shiny Feather. **CHỈ** lấy và lưu vào database các task trả về `Shiny Feather` (vé). Loại bỏ hoàn toàn các nhiệm vụ trả về Coins hoặc thức ăn khác.
    - **Lưu ID DB:** Mọi dữ liệu (Bounties, Animals,...) đều BẮT BUỘC phải lưu kèm theo trường `id: req.id` vào cơ sở dữ liệu.
    - **Ascension Milestones:** Hệ thống bắt buộc phải kiểm tra mốc phần thưởng từ Ascension Age Points. Nếu tài khoản sở hữu vé VIP (có item `Ascension Age Banner`), hệ thống BẮT BUỘC phải cộng thêm phần thưởng vé ở nhánh `premium` tương ứng.
    - **Kiểm tra chênh lệch vé:** Cuối quá trình quét, tổng vé theo dõi được từ tất cả các nguồn (Deliveries, Chores, Bounties, Animals, Daily Chest, và Ascension Milestones) phải được so sánh với tổng vé thực tế lấy từ `gameData.farmActivity["Shiny Feather Collected"]`. Nếu không khớp, UI bắt buộc hiển thị cảnh báo (Warning) cho người dùng để kiểm tra lại nguồn vé.
  - **Cấp độ (Level):** Tuyệt đối KHÔNG regex từ `req.name` (vì API chỉ trả về chữ "Chicken" trơn), mà phải lấy trực tiếp từ thuộc tính `req.level` (VD: `Lv ${req.level}`). API của SFL không trả về cấp cụ thể cho thú, do đó mặc định nó luôn là `Lv ?`.
  - **BẮT BUỘC (Tránh lỗi mất dữ liệu hoặc sai dữ liệu):** Khi đẩy object con vật vào mảng `animals`, PHẢI bao gồm trường `id: req.id` (VD: `animals.push({ animalName, level, reward, rewardType, status, id: req.id });`). Việc thiếu trường này sẽ khiến hệ thống dùng chung key `cow-Lv ?` và ghi đè toàn bộ lịch sử nhiệm vụ cùng loại. Đầu ra ví dụ cần đạt được:
    ```json
    { "animalName": "cow", "level": "Lv ?", "reward": 8, "rewardType": "Shiny Feather", "status": "claimed", "id": "uuid-here" }
    ```
  - Dùng `req.id` để đối chiếu với `gameData.bounties.completed` để check trạng thái `claimed`.
  - **LƯU Ý CỰC KỲ QUAN TRỌNG (Về cấu trúc JSON phần thưởng):** Đối với các task Animals (và Bounties API), phần thưởng được lưu TRỰC TIẾP ở ngoài cùng dưới dạng `req.items` hoặc `req.coins`. Tuyệt đối **KHÔNG ĐƯỢC** gọi `req.reward.items` hay `req.reward.coins` vì API không có object `reward` con ở trong requests. Việc sai cấu trúc này sẽ dẫn đến toàn bộ task (kể cả Coins) bị nhận diện nhầm thành vé!
- **Bounties:** Giao diện SFL.world không hiển thị phần thưởng RewardText nữa. Do đó phải lọc các nhiệm vụ bằng phương thức `.includes()` thay vì so sánh bằng `===` vì tên nhiệm vụ trên web UI có thể chứa số lượng (VD: `10x Cauliflower`).
  - Lấy phần thưởng chính xác từ thuộc tính `req.items` thay vì mặc định là Coins, và CẬP NHẬT GHI ĐÈ vào biến `reward`.
  - **Lưu ý ghép cặp (Matching HTML với API):** Khi ghép cặp Bounties từ HTML DOM với dữ liệu API, phải tính toán **Cộng thêm Buff (Quần áo, Poppy)** vào con số gốc của API trước khi so sánh bằng dấu `===` với con số quét được trên Web. (VD: API = 40, Web = 43. Nếu không cộng buff trước khi so sánh, logic sẽ luôn báo KHÔNG KHỚP và làm xáo trộn thứ tự ID các Bounties giống tên nhau).

---

## 4. Bắt Lỗi Hiển Thị Tên Vật Phẩm (Lỗi Pumpkin15, Broccoli120)
- **Quy tắc:** Khi đọc dữ liệu từ HTML DOM, các vật phẩm đã giao (`.bi-check2-circle`) không sử dụng thẻ `<small>` và `<b>` theo cấu trúc thông thường.
- **Xử lý BẮT BUỘC:** Phải viết thêm điều kiện `else if ($c(bEl).find('.bi-check2-circle').length > 0)` để đọc chính xác `total` và `completed`. Sau đó đảm bảo vật phẩm được đẩy vào danh sách (`reqItems.push`) với đúng tên gốc đã được regex `^[a-zA-Z\s'-]+` tách chữ khỏi số.

## 5. Tự Động Làm Mới Dữ Liệu (Force Update)
- **Quy tắc:** Mặc định khi người dùng mở trang web, hàm auto-fetch (như `handleSearch(savedId)`) trong `useEffect` sẽ dùng dữ liệu cache cũ nếu không được chỉ định tham số.
- **Xử lý BẮT BUỘC:** Mọi lời gọi load dữ liệu tự động lần đầu khi vào web phải truyền tham số `forceUpdate = true` (VD: `handleSearch(savedId, true);`) để đảm bảo luôn hiển thị số liệu thực tế mới nhất thay vì số liệu cũ trong cache.

## 6. UI Dashboard (React Components)
Bất kỳ thành phần bảng nhiệm vụ (Panel) nào ở tab Overview cũng **BẮT BUỘC** phải có thanh tiêu đề tóm tắt (Header Stats) bao gồm:
1. **Tiến Độ:** (Số task `claimed` / Tổng số task).
2. **Tổng Vé / Gems:** (Tính tổng reward).
3. **Tổng Chi phí & Trung bình:** (Dựa trên P2P cost).

(Xem `DeliveriesPanel.jsx` hoặc `BountiesPanel.jsx` để copy layout chuẩn).

## 7. Trạng Thái Hoàn Thành Giao Hàng (Claimed Status)
- **Quy tắc:** SFL.world không còn hiển thị chữ `Claimed` ở cột phần thưởng (Reward) đối với các đơn hàng Deliveries (Tickets & Coins).
- **Xử lý BẮT BUỘC:** Để biết một đơn hàng đã giao thành công chưa, tuyệt đối không phụ thuộc vào text `Claimed`. Thay vào đó, phải duyệt qua danh sách các vật phẩm yêu cầu (`.badge`). Nếu **bất kỳ vật phẩm nào** có chứa icon `<i class="bi bi-check2-circle"></i>`, thì toàn bộ đơn hàng đó BẮT BUỘC được đánh dấu là `claimed = true` (hoặc `hasCheckCircle = true`).

## 8. Xử lý lỗi API và Database (Error Handling)
- **Quy tắc 1:** Tuyệt đối không được bỏ qua (swallow) các lỗi khi gọi API (SFL, sfl.world) hoặc khi kết nối Database. 
- **Quy tắc 2:** Nếu API bị Rate Limit (429) hoặc không phản hồi (timeout), hoặc Database không thể truy xuất, Backend phải THROW ra một lỗi (Exception) với thông báo chi tiết (VD: 'API Sunflower Land đang bị quá tải, vui lòng thử lại sau!' hoặc 'Không thể kết nối đến Database'). 
- **Quy tắc 3:** Frontend phải bắt các lỗi này và hiển thị thông báo chi tiết ra màn hình UI cho người dùng biết, thay vì âm thầm dùng fallback hoặc hiển thị lỗi trắng trang.


## 6. Quy tắc Xử lý Bất đồng bộ và Ánh xạ Chi phí (Async & Mapping Rules)
- **Tất cả các lệnh gọi API bên ngoài** (như fetch 	oolCosts, craftingCosts từ sfl.world) bắt buộc phải được wait đầy đủ và khởi tạo xong xuôi TRƯỚC KHI vòng lặp ánh xạ chores.map chạy.
- Nếu thêm các Chores mới (như Dig, Collect Eggs, Grow Flowers), bắt buộc phải map chúng với các công cụ/nguyên liệu tương ứng (như Shovel, Wheat, Seeds) để hệ thống có thể tính toán chi phí P2P. Tránh tình trạng trả thẳng dữ liệu về Frontend mà thiếu chi phí P2P dẫn đến hiển thị sai hoặc trống.