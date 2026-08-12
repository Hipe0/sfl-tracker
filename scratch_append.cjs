const fs = require('fs');
let content = fs.readFileSync('ALGORITHM_RULES.md', 'utf8');
content += `

## 12. Logic Cơ Chế Nấu Ăn (Cooking Mechanics)
- **Thời gian gốc (Base Time):** Phải tra cứu bảng JSON (\`foodRecipes.json\`) để lấy thời gian gốc và tòa nhà tương ứng.
- **Buff Giảm Thời Gian (Multiplicative Buffs):** Tương tự trồng hoa, buff nấu ăn được nhân dồn (multiplicative). Khởi tạo \`timeMultiplier = 1\`.
  - Kỹ năng \`Fast Feasts\` (Chỉ áp dụng cho \`Fire Pit\` hoặc \`Kitchen\`): Giảm 10% (rank 1), 12.5% (rank 2), 15% (rank 3).
  - Kỹ năng \`Frosted Cakes\` (Chỉ áp dụng cho \`Bakery\`): Giảm 10% (rank 1), 12.5% (rank 2), 15% (rank 3).
  - NFT \`Master Chef's Cleaver\`: Giảm 15%.
  - Wearable \`Luna's Hat\`: Giảm 50%.
  - NFT \`Desert Gnome\`: Giảm 10%.
  - Tổng thời gian nấu = \`Base Time * timeMultiplier\`.
- **Buff Tăng Lợi Nhuận (Multiplicative Buffs):** Khởi tạo \`revenueMultiplier = 1\`.
  - Kỹ năng \`Nom Nom\`: Tăng 10% (rank 1), 15% (rank 2), 20% (rank 3).
  - Wearable \`Chef Apron\` (Chỉ áp dụng cho \`Bakery\`): Tăng 20% lợi nhuận.
  - Wearable \`Chef Hat\` (Chỉ áp dụng cho \`Bakery\`): Tăng 10% lợi nhuận.
  - Tổng lợi nhuận nhận được = \`Phần thưởng cơ bản * revenueMultiplier\`.
`;
fs.writeFileSync('ALGORITHM_RULES.md', content);
