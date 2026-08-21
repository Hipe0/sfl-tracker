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
  - **Delivery for Tickets (Giao Hàng Vé NPC)**.

### B. VIP Buff
- **Quy tắc:** Kiểm tra `inventory.hasVip`. Nếu có, cộng thêm **+2 vé**.
- **Phạm vi Áp dụng BẮT BUỘC:**
  - **Weekly Chores (Nhiệm vụ tuần)**.
  - **Delivery for Tickets (Giao Hàng Vé NPC)**.

### C. Poppy Bounty Bonus
- **Quy tắc:** Kiểm tra nếu tồn tại `summary.poppyBounty` và trạng thái `!== 'danger'`. Nếu có, cộng thêm **+100 vé**.
- **Phạm vi Áp dụng BẮT BUỘC:**
  - **Bounties (Weekly Chores)**.

---

## 2. Giao Hàng Vé (Delivery for Tickets)
Dữ liệu trên web thường bị sai hoặc lỗi số. Tuyệt đối **KHÔNG SỬ DỤNG** số lượng vé cào (scrape) từ giao diện web.

- **Quy tắc 1 (Lọc tên vật phẩm):** Phải sử dụng biểu thức chính quy (Regex) `^[a-zA-Z\s'-]+` để tách riêng chữ ra khỏi số (VD: `Pumpkin15` phải bóc tách thành `Pumpkin`).
- **Quy tắc 2 (Thuật toán Tính Vé):** Số lượng vé nhận được phải được tính toán tuần tự theo đúng logic của mã nguồn game (index.js):
  1. **Điểm Gốc (Base Reward):** Dựa vào bảng `TICKET_REWARDS` cứng:
     ```javascript
     const TICKET_REWARDS = { 
       "pumpkin' pete": 1, 
       "bert": 2, 
       "miranda": 2, 
       "finley": 2, 
       "raven": 4, 
       "finn": 5, 
       "timmy": 5, 
       "cornwell": 3, 
       "jester": 4, 
       "pharaoh": 6, 
       "tywin": 10 
     };
     ```
  2. **VIP Buff:** Nếu người chơi có thẻ VIP (`inventory.hasVip`), cộng thêm **+2** vé.
  3. **Chapter Boosts (Đồ Mùa Giải):** Kiểm tra `gameData.season.season` để biết tên Mùa hiện tại. Sau đó đối chiếu với danh sách `CHAPTER_TICKET_BOOST_ITEMS` của mùa đó (VD: Ascension Age có `Swamp Lily Hat`, `Swamp Armor`, `Swamp Pants`). 
     - **Điều kiện BẮT BUỘC:** Món đồ KHÔNG được tính nếu chỉ nằm trong kho chứa (`wardrobe` / `inventory`). Người chơi **BẮT BUỘC PHẢI MẶC NÓ** trên trang trại.
     - **Phạm vi quét:** Thuật toán phải quét qua toàn bộ các nhân vật đang đứng trên trang trại, bao gồm:
       1. Nhân vật chính (Main Bumpkin): `gameData.bumpkin.equipped`
       2. Các nhân vật phụ (Farmhands): `gameData.farmHands.bumpkins[id].equipped`
     - Nếu phát hiện **bất kỳ nhân vật nào** đang mặc món đồ thuộc mùa giải, lập tức cộng thêm **+1** vé cho món đồ đó (Tối đa +3 vé nếu mặc đủ bộ 3 món).
  4. **Sự kiện Double Delivery:** Nếu lịch game (`gameData.calendar`) hôm nay có sự kiện `doubleDelivery`, hệ số vé sẽ được **nhân 2 (x2)**.
     - **NGOẠI LỆ QUAN TRỌNG:** Việc nhân 2 CHỈ áp dụng cho đơn hàng ĐẦU TIÊN trong ngày của NPC đó. Để biết NPC đó đã giao đơn nào trong ngày chưa, PHẢI kiểm tra trường `gameData.npcs[npcName].deliveryCompletedAt` (trong gameData trả về). Nếu thời gian này trùng với ngày hiện tại (UTC), thì TỪ CHỐI nhân đôi (nghĩa là task thứ 2 trở đi không được x2).

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
- **Tất cả các lệnh gọi API bên ngoài** (như fetch 	oolCosts, craftingCosts từ sfl.world) bắt buộc phải được  wait đầy đủ và khởi tạo xong xuôi TRƯỚC KHI vòng lặp ánh xạ chores.map chạy.
- Nếu thêm các Chores mới (như Dig, Collect Eggs, Grow Flowers), bắt buộc phải map chúng với các công cụ/nguyên liệu tương ứng (như Shovel, Wheat, Seeds) để hệ thống có thể tính toán chi phí P2P. Tránh tình trạng trả thẳng dữ liệu về Frontend mà thiếu chi phí P2P dẫn đến hiển thị sai hoặc trống.

## 9. Nghiệp Vụ Xử Lý Delivery, Cơ Chế Skip và Diff >= 2 (Delivery History Tracking)
- **Cơ sở dữ liệu API (Không có Order ID):** API game chỉ trả về tổng số đơn đã giao (`deliveryCount`) và tổng số lần đã bỏ qua (`skippedCount`), không có ID đơn hàng. Vì vậy, Tracker BẮT BUỘC phải dùng kỹ thuật **Caching (Lưu đệm)** kết hợp với việc **Suy Luận Logic (Logic Deduction)** dựa trên sự thay đổi của 2 chỉ số này để biết chính xác đơn nào bị skip hay complete.
- **Logic Trích Xuất (Suy Luận) Trạng Thái Nhiệm Vụ BẮT BUỘC:**
  - **Trường hợp 1 (Giao 1 đơn):** Nếu qua ngày mới quét thấy `deliveryCount` tăng 1 (và `skippedCount` không đổi), ĐỒNG THỜI quét sfl.world thấy có 1 đơn trạng thái Hoàn thành ("Claimed" / Có dấu tick xanh). -> Kết luận: Chính đơn trên sfl.world đó là đơn vừa được giao. Hệ thống sẽ lấy luôn chỉ số chi phí P2P và phần thưởng của đơn đó ghi vào lịch sử.
  - **Trường hợp 2 (Vừa Skip vừa Giao):** Nếu quét thấy `deliveryCount` tăng 1 VÀ `skippedCount` cũng tăng 1, ĐỒNG THỜI quét sfl.world thấy 1 đơn trạng thái Hoàn thành. -> Kết luận: Đơn đầu tiên đã bị Skip, và đơn thứ 2 mới là đơn vừa được giao thành công (chính là đơn hiển thị Hoàn thành trên web).
  - **Trường hợp 3 (Chỉ Skip):** Nếu quét thấy chỉ có `skippedCount` tăng 1 (và `deliveryCount` giữ nguyên), ĐỒNG THỜI quét sfl.world thấy có 1 đơn nhưng trạng thái CHƯA Hoàn thành (Sẵn sàng giao). -> Kết luận: Đơn đầu tiên đã bị Skip, còn đơn hiện tại đang hiển thị trên web là đơn thứ 2 mới xuất hiện và chưa được giao.
- **Cơ chế Skip và Độ lệch dữ liệu (Logic cộng dồn qua ngày):**
  - Đặt **`totalVariation = diff + skipDiff`** (Tổng biến động giữa lần quét cũ và mới).
  - **Skip:** Game không cho phép dùng Gem để skip ngay lập tức. Tính năng Skip chỉ hiện ra khi đơn hàng tồn đọng quá 24h. Khi người dùng bấm Skip, `skippedCount` tăng 1, Tracker ghi nhận đơn bị "Skipped" (reward = 0).
  - **`totalVariation <= 2` (Logic 2 đơn 1 ngày):** Xảy ra khi người dùng có 1 đơn tồn đọng qua ngày (sau 7h sáng). Họ giao/skip đơn tồn đọng đó. Lập tức game đẩy ra đơn mới của hôm nay, và họ làm tiếp luôn. Lúc này `totalVariation = 2`. Hàm ghi nhận lịch sử sẽ lưu đồng thời cả đơn cũ trong đệm (Cache) và đơn mới trên API.
  - **`totalVariation > 2` (Logic mất dữ liệu do quên quét):** Xảy ra khi người dùng không vào web Tracker nhiều ngày liền (nhưng vẫn chơi game). API chỉ báo tổng biến động > 2, nhưng không cung cấp lịch sử các đơn ở giữa.
    - **Hành động BẮT BUỘC:** Hệ thống **TUYỆT ĐỐI KHÔNG** được chạy vòng lặp tạo ra các đơn ảo (fake orders) hay nhân bản đơn cũ để lấp đầy khoảng trống, vì điều này sẽ làm sai lệch nghiêm trọng báo cáo Lãi/Lỗ (Profit/Loss).
    - **Xử lý:** Vứt bỏ đơn cũ trong cache (do không biết chính xác nó bị giao hay bị skip). **CHỈ** ghi nhận duy nhất đơn mới hiện tại (nếu nó hiển thị Hoàn thành). Chấp nhận việc bảng lịch sử bị nhảy cóc số lượng (gap) để bảo toàn 100% tính chính xác chi phí của những đơn có thật.
- **Lỗi 0 Phần Thưởng (0 SFL / 0 Coin / 0 Ticket) đối với TẤT CẢ NPC khi `diff >= 2` hoặc quét trúng lúc "Claimed":**
  - **Tình trạng:** Bất kỳ NPC nào khi trả thưởng (đặc biệt là Coin/SFL như Guria) đều có thể bị ghi nhận 0 phần thưởng vào lịch sử và rớt `rewardType` thành Unknown.
  - **Nguyên nhân:** Khi nhiệm vụ chuyển sang trạng thái "Claimed" trên web sfl.world, số tiền/vé bị ẩn đi. Quá trình quét bằng HTML trả về `rewardAmount = 0`. Database ưu tiên số mới cào được nên lỡ tay ghi đè số 0 vào lịch sử.
  - **Cách fix BẮT BUỘC:** Đã cập nhật `historyService.cjs` áp dụng cho **TOÀN BỘ NPC**. Nếu phát hiện `status === 'claimed'` và `rewardAmount === 0`, thuật toán BẮT BUỘC phải KHÔI PHỤC (`restore`) `rewardAmount` gốc từ dữ liệu lưu đệm `prevActiveData` của kỳ quét trước. Đồng thời, `farmRoutes.cjs` phải quét đọc trực tiếp `sflOrder.reward.sfl` và `sflOrder.reward.coins` cho bảng `coinDeliveries` để luôn lấy chính xác lượng thưởng của API cho tất cả các NPC trả Coin/SFL.
- **Xử lý Nhân đôi Phần thưởng (x2) vào ngày Sự kiện (Double Delivery):**
  - **Lý do:** Khi người dùng vừa hoàn thành một đơn hàng trong ngày x2, API game lập tức cập nhật `deliveryCompletedAt` thành ngày hôm nay. Thuật toán lấy dữ liệu ở Frontend (`farmRoutes.cjs`) khi so sánh sẽ đánh giá là đơn hàng đã hoàn thành, từ chối gán thêm hệ số x2 cho đơn tiếp theo (để hiển thị đúng), dẫn đến dữ liệu gửi về Backend chỉ mang giá trị gốc X1 và không có chữ `(x2)`.
  - **Hành động BẮT BUỘC:** Trong hàm lưu lịch sử (`addCurrentTask`, `addPrevTask` của `historyService.cjs`), code BẮT BUỘC phải chủ động kiểm tra lại cờ `isX2Day`. Nếu đúng là ngày sự kiện x2 VÀ chuỗi phần thưởng lấy từ Frontend chưa có ký tự x2 (`!String(task.reward).includes('(x2)')`), hệ thống phải NHÂN ĐÔI giá trị (`finalReward *= 2`) trước khi lưu vào DB. Tuyệt đối không lưu thẳng giá trị X1.

## 10. Logic Cơ Chế Trồng Hoa (Flower Breeding)
- **Base Time (Thời gian gốc của hạt giống):** Bắt buộc phải ánh xạ đúng thời gian gốc của từng loại hạt trong JSON data để tính toán tổng thời gian:
  - `Sunpetal Seed`: 1 ngày (24h)
  - `Bloom Seed`: 2 ngày (48h)
  - `Lily Seed`: 5 ngày (120h)
  - Các hạt Exotic (`Edelweiss Seed`, `Gladiolus Seed`, `Lavender Seed`, `Clover Seed`): Bắt buộc là **3 ngày (72h)**.
- **Buff Giảm Thời Gian (Multiplicative Buffs):** Tính toán phần trăm giảm thời gian trồng hoa phải được nhân dồn (multiplicative) chứ không cộng dồn (additive).
  - Khởi tạo hệ số `flowerMultiplier = 1`.
  - Nếu có Skill `Blooming Boost`: Giảm 10% (rank 1), 12.5% (rank 2), 15% (rank 3). Áp dụng công thức: `flowerMultiplier *= (1 - buff/100)`.
  - Nếu có Skill `Flower Power`: Giảm 20% (rank 1), 30% (rank 2), 40% (rank 3). Áp dụng: `flowerMultiplier *= (1 - buff/100)`.
  - Nếu có NFT `Flower Fox`: Giảm 10% (hệ số 0.9).
  - Nếu có NFT `Flower Crown`: Giảm 50% (hệ số 0.5).
  - Thời gian hiển thị cuối cùng = `Tổng thời gian gốc * flowerMultiplier`.
- **Chỉ số Có Sẵn (Inventory Check):** UI Tooltip của hoa bắt buộc phải liên tục đọc từ `gameData.inventory[flowerName]` để hiển thị chính xác số lượng tồn kho hiện tại (kể cả với hoa gốc lẫn các hoa trung gian ở mỗi bước của chuỗi lai tạo `bestRecipeChain`). Điều này giúp người dùng tối ưu chiến thuật nhảy cóc, không phải trồng lại từ đầu.

## 11. Tính Toán Chi Phí Đệ Quy P2P Trung Tâm (Centralized P2P Cost Calculator)
- **Nguồn lấy chi phí P2P:** Hệ thống sử dụng một module duy nhất `costCalculator.cjs` để tự động tính toán đệ quy chi phí P2P cho TẤT CẢ các vật phẩm (Deliveries, Chores, Bounties, Crafting). Module này nạp dữ liệu tĩnh JSON (công thức bếp, rèn, hạt giống, v.v.) một lần duy nhất lúc khởi động, và lấy giá Market từ API `https://sfl.world/api/v1/prices`.
- **Tuyệt đối KHÔNG cào dữ liệu HTML:**
  - Nghiêm cấm việc cào (scrape) giá trị `totalCost`, `P2P` từ các trang web HTML của `sfl.world` như `sfl.world/land/[id]/chapter`, `sfl.world/[id]`, hoặc `sfl.world/info/crafting`. Giao diện HTML rất dễ thay đổi và việc cào dữ liệu thường xuyên làm đứt gãy ứng dụng.
- **Quy đổi Giá P2P:** Dữ liệu trả về từ API `/api/v1/prices` là giá **Market (Giá thị trường)**. Để ra được giá P2P, TẤT CẢ tính toán bên trong hệ thống phải áp dụng công thức trừ đi 10% thuế giao dịch (`Market Price * 0.9`). Module `costCalculator.cjs` đã tích hợp sẵn việc trừ thuế này.
- **Tính Nhất Quán (Consistency):** Mọi giao dịch phải gọi đến hàm `getUniversalCost()` hoặc `getCostForItems()` của bộ máy tính dùng chung. Không được tự viết các hàm tính tay (như `getToolP2PCost`) nằm rải rác ở các file khác nhau.

## 12. Logic Cơ Chế Nấu Ăn (Cooking Mechanics)
- **Thời gian gốc (Base Time):** Phải tra cứu bảng JSON (`foodRecipes.json`) để lấy thời gian gốc và tòa nhà tương ứng.
- **Buff Giảm Thời Gian (Multiplicative Buffs):** Tương tự trồng hoa, buff nấu ăn được nhân dồn (multiplicative). Khởi tạo `timeMultiplier = 1`.
  - Kỹ năng `Fast Feasts` (Chỉ áp dụng cho `Fire Pit` hoặc `Kitchen`): Giảm 10% (rank 1), 12.5% (rank 2), 15% (rank 3).
  - Kỹ năng `Frosted Cakes` (Chỉ áp dụng cho `Bakery`): Giảm 10% (rank 1), 12.5% (rank 2), 15% (rank 3).
  - NFT `Master Chef's Cleaver`: Giảm 15%.
  - Wearable `Luna's Hat`: Giảm 50%.
  - NFT `Desert Gnome`: Giảm 10%.
  - Tổng thời gian nấu = `Base Time * timeMultiplier`.
- **Buff Tăng Lợi Nhuận (Additive Buffs):** Tính cho CẢ Đơn Coins VÀ Đơn SFL. Khởi tạo `bonus = 0`.
  - Kỹ năng `Nom Nom`: Tăng 10% (rank 1), 30% (rank 2), 50% (rank 3) (Quy ra hệ số: `bonus += 0.5`).
  - Wearable `Chef Apron` (Chỉ áp dụng cho các món Bánh ngọt - có chữ `Cake` trong tên): Tăng 20% lợi nhuận (`bonus += 0.2`).
    - *Lưu ý: Món nấu trong lò Bakery nhưng không phải Cake (như Apple Pie, Orange Bread) sẽ KHÔNG được hưởng buff này.*
    - *Lưu ý: Quần áo sẽ có tác dụng nếu được mặc trên người của Main Bumpkin HOẶC bất kỳ Farm Hand nào trên đảo (quét toàn bộ `equipped`).*
  - Wearable `Chef Hat` (Chỉ áp dụng cho `Bakery`): Tăng 10% lợi nhuận (`bonus += 0.1`).
  - Kỹ năng `Betty's Friend` (Chỉ áp dụng cho NPC Betty khi thưởng bằng Coins): Tăng 30% (rank 1), 45% (rank 2), 60% (rank 3) (`bonus += 0.6`).
  - Kỹ năng `Victoria's Secretary` (Chỉ áp dụng cho NPC Victoria khi thưởng bằng Coins): Tăng 50% (rank 1), 75% (rank 2), 100% (rank 3) (`bonus += 1.0`).
  - Kỹ năng `Fishy Fortune` (Chỉ áp dụng cho NPC Corale khi thưởng bằng Coins): Tăng 100% (rank 1), 125% (rank 2), 150% (rank 3) (`bonus += 1.5`).
  - Kỹ năng `Forge-Ward Profits` (Chỉ áp dụng cho NPC Blacksmith khi thưởng bằng Coins): Tăng 20% (rank 1), 30% (rank 2), 40% (rank 3) (`bonus += 0.4`).
  - Kỹ năng `Fruity Profit` (Chỉ áp dụng cho NPC Tango khi thưởng bằng Coins đối với đồ là Trái Cây): Tăng 50% (rank 1), 75% (rank 2), 100% (rank 3) (`bonus += 1.0`).
  - Tổng lợi nhuận nhận được = `Phần thưởng cơ bản * (1 + bonus)`.

## 13. Logic Cơ Chế Chế Tạo (Crafting Mechanics)
- **Base Time (Thời gian gốc của Crafting Box):**
  - Khác với thời gian cố định trên sfl.world, thời gian chế tạo Doll có sự phân hóa:
  - Base Doll (`Doll` cơ bản ghép từ Leather và Wool): **2 giờ**.
  - Các Doll khác (Moo Doll, Bloom Doll, v.v.): **8 giờ**.
- **Buff Giảm Thời Gian (Crafting Multiplier):**
  - Khởi tạo hệ số `craftingMultiplier = 1`.
  - Nếu tài khoản sở hữu NFT `Architect Ruler` (Kiểm tra trong cả `inventory` và `wardrobe`): Giảm 25% thời gian (Hệ số `0.75`).
  - Tổng thời gian chế tạo hiển thị = `Base Time * craftingMultiplier`.
- **Hiển thị Công Thức (Doll nguyên liệu):**
  - Công thức Doll có cấu trúc lưới 3x3 (9 ô).
  - Khi một Doll cao cấp yêu cầu nguyên liệu là các Doll khác (sub-doll), Tracker BẮT BUỘC phải hiển thị đệ quy lưới 3x3 thu nhỏ của sub-doll đó trong mục "Doll nguyên liệu".
  - **NGOẠI LỆ:** Nếu sub-doll được yêu cầu là `Doll` (Base Doll cơ bản), BẮT BUỘC PHẢI BỎ QUA không hiển thị trong mục "Doll nguyên liệu". Lý do là công thức Base Doll quá thông dụng và chiếm nhiều diện tích, việc hiển thị lưới 9 ô dọc/ngang của Base Doll sẽ làm hỏng UI. (Code: `item !== "Doll"`).
- **Lỗi UI Grid (CSS Bug) BẮT BUỘC TRÁNH:**
  - Không được dùng `inline-block` chung với `grid` trong Tailwind nếu phần tử bên trong là danh sách mảng (array map) lưới 3x3. Việc sử dụng `inline-block` sẽ ghi đè tính chất `display: grid` của lưới, khiến 9 ô nguyên liệu bị "xổ dọc xuống" thành 9 dòng liên tiếp.
  - Cách fix bắt buộc: Sử dụng `w-max` thay cho `inline-block`, hoặc dùng `inline-grid` để giữ nguyên thuộc tính lưới của khung.

## 14. Quy tắc UI: Tooltip Dropdown & Overflow Clipping
- **Lỗi Cắt Xén Tooltip (Clipping):** 
  - Khi thiết kế các Tooltip hoặc Dropdown thả xuống dạng `absolute` (ví dụ: `absolute top-full`), **TUYỆT ĐỐI KHÔNG** sử dụng class `overflow-hidden` ở các thẻ container/parent bọc ngoài (như `glass-panel`, các thẻ `div` bọc danh sách). 
  - Nếu dùng `overflow-hidden` ở lớp ngoài, các tooltip/dropdown của những item nằm ở sát viền hoặc hàng cuối cùng của container sẽ bị cắt xén (clipped) theo đường viền và không thể hiển thị toàn bộ nội dung.
  - **Cách xử lý chuẩn:** Chỉ dùng `relative` cho thẻ container/parent. Nếu thẻ cha cần bo góc (rounded), không dùng `overflow-hidden` để ép bo góc nội dung tuyệt đối.
- **Lỗi Tooltip bị đè kín dưới Panel (Z-Index Overlap Bug):**
  - **Tình trạng:** Tooltip hiển thị bị các bảng (panels) bên dưới che khuất do hiệu ứng CSS `backdrop-blur` tạo ra một Stacking Context mới giam giữ `z-index`.
  - **Cách fix BẮT BUỘC:** Trong toàn bộ các File Component Tooltip (`FoodTooltip`, `FlowerTooltip`, `FishTooltip`, `FishingTooltip`, `DollTooltip`), giá trị cấu hình `z-index` tuyệt đối phải được đặt cực lớn: **`z-[99999]`** thay vì `z-[100]`. Đồng thời bổ sung css global `.glass-panel:hover { @apply relative z-[60]; }` để ép thẻ cha nổi lên mỗi khi Hover. Điều này đảm bảo Tooltip luôn được đè ưu tiên lên trên tất cả các trang và bảng.

## 15. Cơ Chế Gọi API và Tránh Giới Hạn Quá Tải (Rate Limiting)
- **API `sunflower-land.com` và Proxy `sfl.world`**: Hệ thống API của game có cơ chế bảo mật rất khắt khe để chống spam (ví dụ: trả về `401 Unauthorized` nếu không có API Key, hoặc `429 Rate Limit` nếu gọi quá nhanh).
- **Quy tắc khi Quét Hàng Loạt (Bulk Scraping)**:
  - Tuyệt đối không được gọi API song song (parallel) khi quét danh sách lớn các trang trại (ví dụ: vòng lặp qua hàng loạt ID cơ sở dữ liệu). Gọi đồng loạt nhiều request cùng lúc sẽ ngay lập tức bị chặn và trả về lỗi.
  - Phải xử lý gọi tuần tự (one by one) "lấy từng cái", với độ trễ (delay) vừa đủ (ví dụ: 2 - 15 giây tùy vào endpoint) để máy chủ có thời gian phản hồi mà không kích hoạt tường lửa chống spam.
  - Phải luôn có cơ chế bắt lỗi `429` (Rate Limit) để tự động ngủ đông (sleep) và gọi lại sau thay vì bỏ qua dữ liệu.

## 16. Quy tắc UI: Hiển thị Công Thức Lai Tạo Hoa (Flower Tooltip)
- **Hiển thị chi tiết nguyên liệu lai tạo (Crossbreed Details):** 
  - Trong chuỗi lai tạo nhanh nhất (`bestRecipeChain`), UI không được chỉ hiển thị mỗi Hạt giống (Seed) và Thời gian. **BẮT BUỘC** phải hiển thị chi tiết vật phẩm lai tạo (Crossbreed item) đi kèm với hạt giống đó.
  - Định dạng hiển thị chuẩn: `[Hạt giống] + [Quả/Hoa Lai Tạo] ➡️ [Hoa Kết Quả]`.
- **Logic Trích xuất Nguyên liệu Lai tạo:** Do `bestRecipeChain` chỉ lưu trữ chuỗi các hoa kết quả, UI phải tự động nội suy (infer) vật phẩm lai tạo dựa vào bước hiện tại (step index):
  - **Bước đầu tiên (stepIdx === 0):** Hoa được lai từ một loại Quả/Cây trồng (Crop). Bắt buộc phải ánh xạ ngược vào mảng `crops` của hoa đó để render icon của Quả (VD: Apple, Sunflower).
  - **Các bước tiếp theo (stepIdx > 0):** Hoa được lai từ chính bông hoa ở bước liền trước nó. Bắt buộc phải render icon của hoa ở `stepIdx - 1` làm vật phẩm lai tạo.

## 17. API Keys cho API chính thức
- **Thay đổi từ SFL**: Game đã bổ sung yêu cầu API Keys cho các endpoint GET /farms và GET /farms/{id}. x-api-key phải luôn được truyền vào header khi gọi hai endpoint này từ bất kỳ chỗ nào trong code (đã đặt sẵn trong .env đối với server backend).

## 18. Logic tính toán và lưu trữ Market Stats (Coins & FLOWER Token)
- **FLOWER Token**:
  - Nguồn giá gốc (USD): Fetch từ GeckoTerminal API (https://api.geckoterminal.com/api/v2/networks/base/pools/0xafe30319a948f322585fafc1cab1671a47eb3786).
  - Phải được fetch mỗi khi gọi endpoint /api/farm/:id để đảm bảo dữ liệu luôn realtime khi người dùng yêu cầu (On-demand) thay vì chạy Cron Job.
- **Tỷ giá Coin tốt nhất (Best Coin Rate - 1:X)**:
  - Đại diện cho số lượng Coins in-game mà người chơi nhận được khi quy đổi 1 FLOWER/SFL (P2P Market -> Seed Shop).
  - Tỷ giá này KHÔNG DÙNG CHUNG TOÀN SERVER. Nó phụ thuộc vào các Buff của riêng từng nông trại (VD: Coin Swindler, Green Thumb, Cultivator).
  - Thuật toán: Lặp qua toàn bộ cây trồng, tìm Max của coinsPerFlower = (baseSellCoins * (1 + buff)) / p2pPrice.
- **Lưu trữ Database**:
  - Cả `flowerUsdPrice` và `bestCoinRate` (của từng farm) phải được gom thành object `marketStats`.
  - Phải được upsert (cập nhật đè) liên tục vào đúng document `_id = farmId` trong collection `history` (hoặc profile người dùng) mỗi khi họ trigger update/search. 
  - Lý do: Đảm bảo hệ thống internal sau này có thể truy xuất chính xác tỷ giá cá nhân hóa của bất kỳ ID nào từ DB mà không cần tính toán lại.

- **Quy tắc Fallback Tỷ giá Coin (TUYỆT ĐỐI KHÔNG Fallback 1200)**:
  - Khi tính toán `bestCoinRate` từ API trả về `0` hoặc không thành công, **TUYỆT ĐỐI KHÔNG** được tự ý fallback tỷ giá `coinRate` về con số hardcode `1200`.
  - Thay vào đó, hệ thống **BẮT BUỘC** phải ưu tiên đọc lại tỷ giá `bestCoinRate` gần nhất đã được lưu trong cơ sở dữ liệu (`farmHistory.marketStats.bestCoinRate`) của chính `farmId` đó để sử dụng.
  - Đồng thời, giá trị tỷ giá từ DB này phải được ghi đè vào biến truyền tải `globalConfig.coinRate` để đảm bảo Frontend (đặc biệt là bảng Coin Deliveries) luôn dùng thống nhất một tỷ giá chuẩn thay vì mặc định sai lệch.

## 19. Logic Trích Xuất và Tính Toán Chi Phí Chế Tạo (Crafting Box & Consumables)
- **Công Thức Hộp Chế Tạo (Crafting Box):** Các vật phẩm được chế tạo trong Lò rèn (như `Crimsteel`, `Timber`, `Kelp Fibre`, `Ocean's Treasure`,...) có công thức thực tế **BỊ ẨN HOÀN TOÀN TRÊN SERVER (Backend)** nhằm chống gian lận. 
  - Trong mã nguồn frontend (thư mục `src/`), các tệp test như `startCrafting.test.ts` chỉ chứa dữ liệu giả lập (mock data) ví dụ như 9 ô giống hệt nhau. 
  - **Hành động BẮT BUỘC:** Tuyệt đối không trích xuất và tin tưởng công thức Crafting Box từ mã nguồn frontend. Phải hardcode (code cứng) chính xác công thức chuẩn của game (ví dụ: `Crimsteel` = 3 Crimstone, 3 Iron) vào file lưu trữ nội bộ (như `dollRecipes.json` / `craftingBoxRecipes.json`).
- **Công Thức Nấu Ăn (Consumables / Food):** Khác với Lò rèn, công thức các món ăn trung gian và cao cấp (như `Cheese`, `Blue Cheese`, `Honey Cheddar`,...) **CÓ SẴN** công khai trong mã nguồn frontend tại tệp `src/features/game/types/consumables.ts`.
  - **Hành động BẮT BUỘC:** Phải chú ý tìm và trích xuất đầy đủ tất cả thực phẩm (bao gồm cả các món phụ trợ) từ tệp này để có công thức chuẩn.
- **Tính toán Đệ Quy Chi Phí (Recursive Cost Calculation):** Khi tính toán tổng chi phí (P2P/Coins) ra SFL cho bất kỳ vật phẩm nào, thuật toán **BẮT BUỘC** phải sử dụng đệ quy (Recursion) để dò tới tận cùng nguyên liệu gốc. 
  - *Ví dụ:* Tính giá `Blue Cheese` phải gọi đệ quy để tính giá `Cheese`, từ đó suy ra giá `Milk`.

## 20. Phân luồng Định Giá (Market Price vs Crafting Cost)
- **Hành động Giao hàng (Deliveries) và các Chores Tiêu thụ (Cook, Eat, Prepare, Sell):** 
  - Đây là các hành động làm mất vật phẩm cuối (End-item). Chi phí cơ hội của chúng là số tiền thu được nếu đem bán trực tiếp vật phẩm đó.
  - **Hành động BẮT BUỘC:** Phải LUÔN LUÔN ưu tiên lấy giá thị trường (P2P Market Price) của vật phẩm đó làm chi phí. Tuyệt đối KHÔNG bóc tách đệ quy xuống các nguyên liệu thành phần nếu vật phẩm đó đã có giá trên chợ. Nếu không có giá trên chợ mới fallback về giá chế tạo.
- **Hành động Sản xuất (Pick, Grow, Harvest):** 
  - Đây là các hành động tạo ra vật phẩm. Chi phí của chúng là vốn liếng bỏ ra ban đầu.
  - **Hành động BẮT BUỘC:** Phải tính toán dựa trên Giá Hạt Giống (Seed Price) chia cho số lần thu hoạch. Khác với giao hàng, không lấy giá P2P để gán cho các hành động này.
- **Đồng bộ hóa Backend và Frontend (Total Cost Match):** 
  - Tổng chi phí hiển thị ở dưới cùng của bảng Deliveries (tính toán từ Backend qua `getCostForItems`) và Tổng phụ (Grand Total) trong bảng Tooltip (Frontend) **BẮT BUỘC** phải khớp nhau 100%.
  - Để làm được điều này, hàm `getCostForItems` trong `costCalculator.cjs` cũng phải tuân thủ nghiêm ngặt Rule #20: **Luôn gọi hàm `getP2PPrice` để kiểm tra giá chợ trước khi tính tổng**. Nếu có giá chợ, nhân thẳng với số lượng; nếu không có, mới gọi `getUniversalCost` để đệ quy nguyên liệu. Không bao giờ được phép mặc định gọi `getUniversalCost` cho hành động giao hàng.
