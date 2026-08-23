# Tự Điển Dữ Liệu API (SFL GameData API Dictionary)

Tệp này mô tả chi tiết các trường dữ liệu (fields) được trả về từ API `https://api.sunflower-land.com/community/farms/{id}` (trong object `gameData.farm`), là nền tảng cốt lõi của SFL Tracker. Tất cả thông tin dưới đây là 100% chính xác lấy từ cấu trúc JSON thực tế, tuyệt đối không bịa đặt hay phỏng đoán. 

Đối với những trường chưa rõ công dụng hoặc hiếm khi dùng, sẽ được đánh dấu là "Không rõ".

---

## 1. Dữ liệu Cơ bản (Basic Data)
- **`id`**: *(Number)* ID của trang trại.
- **`username`**: *(String)* Tên hiển thị của trang trại.
- **`coins` / `balance`**: *(Number)* Số dư Coins hiện tại của người chơi. (SFL token không nằm ở đây).
- **`inventory`**: *(Object)* Kho chứa vật phẩm (không bao gồm đồ đang mặc). Mỗi Key là tên vật phẩm (VD: `"Pumpkin"`, `"Axe"`), Value là số lượng. Trả về `undefined` nếu chưa từng sở hữu.
- **`wardrobe`**: *(Object)* Kho chứa thời trang (quần áo, NFT thời trang) của người chơi. Tương tự inventory.
- **`createdAt`**: *(Number)* Timestamp Unix (mili-giây) ghi nhận thời điểm tạo account.

## 2. Thông tin Nhân vật (Bumpkin)
Nằm trong object `gameData.bumpkin`.
- **`experience`**: *(Number)* Điểm kinh nghiệm (XP) hiện tại của nhân vật. Từ điểm này, có thể quy đổi ra Level thông qua bảng `LEVEL_EXPERIENCE`.
- **`equipped`**: *(Object)* Các món đồ thời trang ĐANG MẶC trên người nhân vật chính. Các Key bao gồm: `background`, `body`, `hair`, `shirt`, `pants`, `shoes`, `tool`, `hat`, `necklace`, `secondaryTool`...
- **`skills`**: *(Object)* Danh sách các Kỹ năng (Skills) đã học. Key là tên kỹ năng (VD: `"Green Thumb"`), Value là cấp độ Rank (VD: `1`, `2`, `3`).

## 3. Quản lý Thú cưng / Nhân vật phụ (Farm Hands)
Nằm trong object `gameData.farmHands.bumpkins`.
- **`bumpkins`**: *(Object)* Mỗi key là một ID nhân vật phụ. Mỗi nhân vật phụ lại có một object `equipped` (các món đồ đang mặc) giống hệt nhân vật chính.

## 4. Khu vực & Môi trường (Island & Season)
- **`island.type`**: *(String)* Môi trường hòn đảo hiện tại. Các giá trị thường gặp: `"basic"`, `"spring"`, `"desert"`, `"volcano"`.
- **`island.ascensionLevel`**: *(Number)* Cấp độ thăng hoa (Prestige). Mỗi lần thăng hoa sẽ reset Level về 1 nhưng chỉ số này tăng lên. Cần cộng chung với kinh nghiệm để ra Cấp độ thực tế (Total Level).
- **`season.season`**: *(String)* Tên của mùa giải hiện tại (VD: `"Ascension Age"`, `"Catch the Kraken"`).
- **`season.startedAt` / `season.ticket`**: *(Number / String)* Thời gian bắt đầu và tên của loại vé tương ứng mùa giải (VD: `"Shiny Feather"`).

## 5. Dữ liệu VIP & Quyền lợi (VIP Access)
Nằm trong object `gameData.vip`.
- **`expiresAt`**: *(Number)* Timestamp hết hạn của thẻ VIP. Nếu `expiresAt > Date.now()`, tài khoản ĐANG CÓ VIP.

## 6. Giao Hàng & Đơn Hàng (Deliveries)
Nằm trong object `gameData.delivery` và `gameData.npcs`.
- **`delivery.orders`**: *(Array of Objects)* Danh sách các đơn hàng hiện có trên bảng giao hàng. Mỗi phần tử chứa:
  - `id`: Tên NPC giao hàng (VD: `"tywin"`, `"betty"`).
  - `createdAt`: *(Number)* Thời gian xuất hiện đơn.
  - `completedAt`: *(Number | undefined)* Thời gian hoàn thành đơn. Nếu có, tức là "Claimed".
  - `items`: *(Object)* Danh sách vật phẩm yêu cầu.
  - `coins`: *(Number)* Số coin yêu cầu (nếu có).
  - `reward`: *(Object)* Phần thưởng gốc từ game. Có thể chứa `items`, `coins`, `sfl`, `tickets`.
- **`npcs`**: *(Object)* Thống kê về các NPC. VD: `gameData.npcs['tywin']`.
  - `deliveryCount`: *(Number)* Tổng số đơn đã GIAO THÀNH CÔNG cho NPC này từ trước tới nay.
  - `skippedCount`: *(Number)* Tổng số đơn đã BỎ QUA (Skip) của NPC này.
  - `deliveryCompletedAt`: *(Number)* Timestamp lần giao hàng cuối cùng thành công cho NPC này. (Dùng để check sự kiện x2 trong ngày).

## 7. Bảng Nhiệm Vụ (Bounties & Animals)
Nằm trong object `gameData.bounties`.
- **`requests`**: *(Array of Objects)* Danh sách các nhiệm vụ Bounties và Animals hiện tại.
  - `id`: *(String)* UUID định danh nhiệm vụ (RẤT QUAN TRỌNG, dùng để đối chiếu).
  - `name`: *(String)* Tên nhiệm vụ (VD: `"3x Pumpkin"`, `"Chicken"`).
  - `level`: *(Number)* Cấp độ yêu cầu của nhiệm vụ động vật (Animal task). VD: `2`.
  - `coins` / `items` / `sfl`: *(Number/Object)* Mức phần thưởng. LƯU Ý: Phần thưởng nằm thẳng ở object cấp 1, không có object bọc `reward` như Delivery.
- **`completed`**: *(Array of Objects)* Các nhiệm vụ đã nhận thưởng.

## 8. Nhiệm Vụ Hàng Tuần (Weekly Chores)
Nằm trong object `gameData.choreBoard`. Chú ý: `gameData.chores` là phiên bản cũ, phiên bản hiện tại dùng `choreBoard`.
- **`choreBoard.chores`**: *(Object)* Các nhiệm vụ tuần. Key là số thứ tự (ID).
  - `activity`: *(String)* Tên hành động yêu cầu (VD: `"Chop Tree"`, `"Harvest Crop"`).
  - `requirement`: *(Number)* Số lần yêu cầu thực hiện.
  - `tickets`: *(Number)* Số vé thưởng.
  - `completedAt`: *(Number)* Thời gian hoàn thành (nếu có).
  - `bumpkinId`: *(Number)* ID của nhân vật sẽ giao nhiệm vụ.

## 9. Thống Kê Hoạt Động (Farm Activity)
Nằm trong object `gameData.farmActivity`.
- Đây là một Object khổng lồ đếm **tổng số lượng** mọi hành động của người chơi từ lúc lập nick. (VD: `gameData.farmActivity["Pumpkin Harvested"]`, `gameData.farmActivity["Shiny Feather Collected"]`). Rất hữu ích để check chéo tổng số vé kiếm được thực tế.

## 10. Rương Hằng Ngày & Sa Mạc (Daily Chest & Desert)
- **`dailyRewards.chest.collectedAt`**: *(Number)* Timestamp lần gần nhất mở rương hằng ngày của VIP.
- **`desert.digging.streak.collectedAt`**: *(Number)* Lần gần nhất cày sa mạc.
- **`desert.digging.grid`**: *(Array)* Mảng lưu các ô đã đào trên lưới cày sa mạc.

## 11. Các Trường Không Sử Dụng (Hoặc Không Rõ Chức Năng Dành Cho Việc Tracking)
Những trường dữ liệu sau đây có tồn tại trong GameData nhưng thường không được dùng hoặc không mang lại giá trị cho Tracker P2P/Vé:
- **`trees`, `stones`, `iron`, `gold`, `crimstones`...**: Lưu trữ vị trí (x,y) và thời gian phục hồi của từng mỏ quặng, cây xanh trên bản đồ. (Chỉ dùng cho việc render map).
- **`buildings`, `collectibles`**: Vị trí các công trình trên bản đồ.
- **`mailbox`, `conversations`**: Lịch sử đối thoại với NPC.
- **`specialEvents`, `megastore`, `pumpkinPlaza`**: Các sự kiện đặc biệt theo mùa, không ổn định.
- **`minigames`, `fishing`, `crabTraps`**: Dữ liệu riêng lẻ của các minigame câu cá/đặt bẫy cua (ít liên quan đến thống kê vé).
- **`socialFarming`, `telegram`, `discord`, `ban`**: Thông tin mạng xã hội hoặc trạng thái khóa tài khoản.

---
> **Quy định đối với AI:** Khi thao tác với bất kỳ dữ liệu nào, BẮT BUỘC tham chiếu file này để gọi chính xác tên biến. Không được sử dụng trí nhớ tưởng tượng hoặc bịa ra các biến như `req.reward.items` cho Bounties (vì thực tế nó là `req.items`).
