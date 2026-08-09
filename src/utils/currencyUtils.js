/**
 * Định dạng số với giới hạn tối đa 4 chữ số thập phân (tránh lỗi 114.00000000000036).
 * Trả về chuỗi để hiển thị, hoặc số để tiếp tục tính toán.
 * @param {number|string} value Giá trị cần định dạng
 * @param {number} decimals Số chữ số thập phân tối đa
 * @returns {string} Chuỗi đã format
 */
export const formatCurrency = (value, decimals = 4) => {
  if (value === undefined || value === null || isNaN(value)) return '0';
  const num = Number(value);
  // Loại bỏ các số 0 thừa ở cuối
  return parseFloat(num.toFixed(decimals)).toString();
};

/**
 * Tính tỉ suất lợi nhuận (Lãi/Lỗ)
 * @param {number} revenue Tổng thu
 * @param {number} cost Tổng chi phí
 * @returns {number} Lợi nhuận (có thể âm)
 */
export const calculateProfit = (revenue, cost) => {
  const r = Number(revenue) || 0;
  const c = Number(cost) || 0;
  return r - c;
};

/**
 * Tính phần trăm ROI
 * @param {number} profit Lợi nhuận
 * @param {number} cost Chi phí gốc
 * @returns {string} Phần trăm ROI đã format (ví dụ: "+15.5" hoặc "-10.0")
 */
export const calculateROI = (profit, cost) => {
  if (!cost || cost === 0) return profit > 0 ? '+100' : '0';
  const p = Number(profit) || 0;
  const c = Number(cost);
  const roi = (p / c) * 100;
  const sign = roi > 0 ? '+' : '';
  return `${sign}${formatCurrency(roi, 1)}`;
};
