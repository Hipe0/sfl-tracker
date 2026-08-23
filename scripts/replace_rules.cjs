const fs = require('fs');
let content = fs.readFileSync('ALGORITHM_RULES.md', 'utf8');

content = content.replace(
  "Giao diện HTML chỉ được dùng làm phương án dự phòng (fallback).",
  "**TUYỆT ĐỐI KHÔNG** được cào dữ liệu từ HTML DOM (`cheerio`) cho bất kỳ loại nhiệm vụ nào nữa (Deliveries, Chores, Bounties, Animals) vì HTML của sfl.world hay bị ẩn hoặc thay đổi cấu trúc."
);

content = content.replace(
  "- **Quy tắc 1 (Lọc tên vật phẩm - Dành cho Fallback HTML):** Phải sử dụng biểu thức chính quy (Regex) `^[a-zA-Z\\s'-]+` để tách riêng chữ ra khỏi số (VD: `Pumpkin15` phải bóc tách thành `Pumpkin`).\n",
  ""
);

content = content.replace(
  "## 3. Quét API Bounties & Animals",
  "## 3. Quét API Bounties, Animals & Chores (Cấm Cào Web)"
);

content = content.replace(
  "Phải luôn sử dụng `gameData.bounties.requests` từ SFL API.",
  "Quy tắc tối thượng hiện nay là **CẤM DÙNG Cheerio để cào DOM HTML** đối với các task này. Phải luôn sử dụng API gốc của SFL:\n- **Chores:** Bắt buộc xây dựng từ `gameData.chores.chores`.\n- **Animals & Bounties:** Bắt buộc xây dựng từ `gameData.bounties.requests`."
);

content = content.replace(
  "## 4. Bắt Lỗi Hiển Thị Tên Vật Phẩm (Lỗi Pumpkin15, Broccoli120)\n- **Quy tắc:** Khi đọc dữ liệu từ HTML DOM, các vật phẩm đã giao (`.bi-check2-circle`) không sử dụng thẻ `<small>` và `<b>` theo cấu trúc thông thường.\n- **Xử lý BẮT BUỘC:** Phải viết thêm điều kiện `else if ($c(bEl).find('.bi-check2-circle').length > 0)` để đọc chính xác `total` và `completed`. Sau đó đảm bảo vật phẩm được đẩy vào danh sách (`reqItems.push`) với đúng tên gốc đã được regex `^[a-zA-Z\\s'-]+` tách chữ khỏi số.",
  "## 4. (ĐÃ XÓA - Không còn áp dụng)\n- Chú ý: Trước đây có lỗi HTML Pumpkin15, nhưng do hiện tại chúng ta 100% dùng dữ liệu API gốc (`gameData`) cho mọi task, nên lỗi cào text HTML không còn tồn tại nữa. Các quy tắc regex để sửa HTML DOM đã được vô hiệu hóa hoàn toàn."
);

fs.writeFileSync('ALGORITHM_RULES.md', content, 'utf8');
console.log('Replaced successfully');
