/**
 * Giá nên hiện (bảng, biểu đồ) cho 1 đề xuất, theo đúng quyết định của nó.
 * Backend luôn trả buyPrice/sellTarget của kế hoạch vòng mùa (ở chế độ mua giá sàn thì buyPrice = giá hiện tại),
 * kể cả khi quyết định là Bán/Chờ. Hiện nguyên các số đó thì thành vạch "Mua" ngay lúc đang báo Bán.
 * - Mua: giá mua, giá bán mục tiêu, lãi ròng
 * - Bán: giá bán cho người đang giữ (đỉnh gần nhất, không thấp hơn giá hiện tại); offer mua lại nếu có kế hoạch
 * - Chờ: chỉ có offer khi nó thấp hơn giá hiện tại và có hạn offer (đặt sẵn để mua đáy)
 * - Không / Chưa rõ: không có giá
 */
export function planView(s) {
  const none = { buy: null, sell: null, net: null };
  if (!s || s.decision === 'none' || s.decision === 'avoid') return none;
  const plannedOffer = s.buyPrice > 0 && Boolean(s.buyBy) && s.price > 0 && s.buyPrice < s.price;
  if (s.decision === 'buy') {
    return { buy: s.buyPrice > 0 ? s.buyPrice : null, buyLabel: 'Mua', sell: s.sellTarget ?? null, net: s.netMargin ?? null };
  }
  if (s.decision === 'sell') {
    const sell = Math.max(s.cycle?.holdPeakPrice || 0, s.price || 0) || null;
    return { buy: plannedOffer ? s.buyPrice : null, buyLabel: 'Mua lại', sell, sellNow: true, net: null };
  }
  return plannedOffer
    ? { buy: s.buyPrice, buyLabel: 'Offer', sell: s.sellTarget ?? null, net: s.netMargin ?? null }
    : none;
}
