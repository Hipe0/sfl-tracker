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
- **Cơ sở dữ liệu API (Không có Order ID):** API game chỉ trả về tổng số đơn đã giao (`deliveryCount`) và tổng số lần đã bỏ qua (`skippedCount`), không có ID đơn hàng. Vì vậy, Tracker BẮT BUỘC phải dùng kỹ thuật **Caching (Lưu đệm)** vào biến `active_deliveries` ở mỗi lần quét để ghi nhớ đơn hàng đang chờ hiện tại.
- **Phát hiện Giao hàng & Cập nhật Lịch sử:**
  - Nếu `currentDeliveryCount > prevDeliveryCount` (`diff > 0`), hệ thống nhận diện là có đơn vừa giao xong.
  - **BẮT BUỘC:** Khi ghi nhận lịch sử cho đơn vừa giao, code phải ưu tiên moi dữ liệu từ trong đệm (`active_deliveries` của lần quét trước) ra để ghi, tuyệt đối không được phép lấy dữ liệu của đơn mới toanh vừa xuất hiện trên API (trạng thái `ready`) để gán làm đơn đã giao, vì làm vậy sẽ gây lỗi mất đơn cũ và ghi khống đơn mới.
- **Cơ chế Skip và `diff >= 2` (Logic cộng dồn qua ngày):**
  - **Skip:** Game không cho phép dùng Gem để skip ngay lập tức. Tính năng Skip chỉ hiện ra khi đơn hàng tồn đọng quá 24h (reset lúc 0:00 UTC / 7:00 sáng VN). Khi người dùng bấm Skip, `skippedCount` tăng 1, Tracker nhận diện và ghi nhận đơn bị "Skipped" (reward = 0).
  - **`diff >= 2`:** Xảy ra khi người dùng có 1 đơn tồn đọng qua ngày (sau 7h sáng). Họ giao xong đơn tồn đọng đó (được +1 count). Lập tức game đẩy ra đơn mới của hôm nay, và họ có sẵn đồ giao tiếp luôn (được thêm +1 count). Lúc này `diff = 2`. Do đó hàm ghi nhận lịch sử (`addPrevTask` và `addCurrentTask`) được thiết kế bắt buộc phải ghi nhận đồng thời cả đơn cũ trong đệm và đơn mới trên API trong cùng một lần đồng bộ.
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

## 11. Xử Lý Bất Đồng Bộ Dữ Liệu sfl.world (Stale HTML) và Chi Phí P2P
## 11. Xử Lý Bất Đồng Bộ Dữ Liệu sfl.world (Stale HTML) và Chi Phí P2P
- **Nguồn lấy chi phí P2P:** Hệ thống cào (scrape) giá trị `totalCost` (Total P2P Cost) từ bảng HTML mục Delivery của trang `sfl.world/land/[id]/chapter` (đối với Tickets). Lý do là sfl.world có sẵn bộ máy tính toán đệ quy phức tạp cho các vật phẩm chế tạo (như Sand Drill cần Than, Đá Đỏ Crimstone...), nên việc lấy trực tiếp giá từ sfl.world sẽ chuẩn xác hơn việc tự tính thủ công. Đối với Coin/SFL Deliveries, sfl.world không cung cấp `totalCost`, hệ thống bắt buộc phải tự tính bằng công thức nội bộ.
- **Vấn đề Bất đồng bộ (Lag):** Khi người chơi vừa giao xong Đơn 1, API game ngay lập tức cập nhật danh sách đồ của Đơn 2. Tuy nhiên, HTML của sfl.world cập nhật chậm hơn và vẫn hiển thị Đơn 1 kèm theo chi phí cũ của Đơn 1.
- **Hành động BẮT BUỘC (Chốt Kiểm Tra Chéo đối với Tickets):** Khi ghi đè danh sách vật phẩm yêu cầu (`reqItems`) bằng dữ liệu API (`sflOrder.items`), hệ thống **BẮT BUỘC phải so sánh (cross-check)** xem danh sách đồ của API có khớp với danh sách đồ cào được từ HTML hay không.
  - Nếu **KHÔNG KHỚP** (sfl.world đang bị lag): TUYỆT ĐỐI KHÔNG sử dụng `totalCost` cào được từ HTML (vì đó là giá của đơn cũ). Phải tạm thời đặt `totalCost = 0` (hoặc rỗng) để chờ sfl.world cập nhật, qua đó kích hoạt cơ chế Vá Lỗi Ngược (Retro-Patch) trong HistoryService.
  - Nếu **KHỚP**: Chấp nhận sử dụng `totalCost` đã cào được từ HTML vì sfl.world đã hiển thị đúng đơn mới.
- **Tuyệt đối không tự tính lại giá cho Tickets (No Fallback Recalculation):** Không được dùng công thức đơn giản (`toolCosts[name] + p2pPrices[name]`) để tự tính giá P2P nếu `totalCost` bị khuyết. Việc tự tính sẽ ra sai bét với các món đồ chế tạo (ví dụ Sand Drill tính ra 0.08 SFL thay vì 4.85 SFL).
- **Trường hợp ngoại lệ (Coin & SFL Deliveries):** Vì sfl.world không hiển thị `totalCost` cho các NPC trả Coin và SFL, hệ thống BẮT BUỘC phải áp dụng cơ chế tự tính (Fallback Recalculation) ngay lập tức dựa trên dữ liệu đồ đạc mới của API (`apiReqItems`). Không được đặt giá về 0 đối với Coin/SFL vì sẽ gây mất dữ liệu lịch sử.

## 12. Logic Cơ Chế Nấu Ăn (Cooking Mechanics)
- **Thời gian gốc (Base Time):** Phải tra cứu bảng JSON (`foodRecipes.json`) để lấy thời gian gốc và tòa nhà tương ứng.
- **Buff Giảm Thời Gian (Multiplicative Buffs):** Tương tự trồng hoa, buff nấu ăn được nhân dồn (multiplicative). Khởi tạo `timeMultiplier = 1`.
  - Kỹ năng `Fast Feasts` (Chỉ áp dụng cho `Fire Pit` hoặc `Kitchen`): Giảm 10% (rank 1), 12.5% (rank 2), 15% (rank 3).
  - Kỹ năng `Frosted Cakes` (Chỉ áp dụng cho `Bakery`): Giảm 10% (rank 1), 12.5% (rank 2), 15% (rank 3).
  - NFT `Master Chef's Cleaver`: Giảm 15%.
  - Wearable `Luna's Hat`: Giảm 50%.
  - NFT `Desert Gnome`: Giảm 10%.
  - Tổng thời gian nấu = `Base Time * timeMultiplier`.
- **Buff Tăng Lợi Nhuận (Multiplicative Buffs):** Khởi tạo `revenueMultiplier = 1`.
  - Kỹ năng `Nom Nom`: Tăng 10% (rank 1), 15% (rank 2), 20% (rank 3).
  - Wearable `Chef Apron` (Chỉ áp dụng cho `Bakery`): Tăng 20% lợi nhuận.
  - Wearable `Chef Hat` (Chỉ áp dụng cho `Bakery`): Tăng 10% lợi nhuận.
  - Tổng lợi nhuận nhận được = `Phần thưởng cơ bản * revenueMultiplier`.

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
  - **Cách xử lý chuẩn:** Chỉ dùng `relative` cho thẻ container/parent, kết hợp `z-index` (như `z-50`) cho thẻ `absolute` tooltip. Nếu thẻ cha cần bo góc (rounded), không dùng `overflow-hidden` để ép bo góc nội dung tuyệt đối.
