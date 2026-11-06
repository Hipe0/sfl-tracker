/** Định dạng số/thời gian dùng chung cho giao diện FLIP */

export const fmtNum = (n, digits = 2) =>
  n == null || Number.isNaN(Number(n)) ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Giá tài nguyên thường rất nhỏ (0.0001): giữ 4 chữ số có nghĩa */
export const fmtPrice = n => {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  const v = Number(n);
  if (v === 0) return '0';
  if (Math.abs(v) >= 100) return fmtNum(v, 2);
  return Number(v.toPrecision(4)).toString();
};

export const fmtCompact = n => {
  if (n == null || !Number.isFinite(Number(n))) return '–';
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n));
};

export const fmtPct = (n, digits = 1) => (n == null || !Number.isFinite(n) ? '–' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(digits)}%`);

export const fmtTime = ts => (ts ? new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '–');

export const fmtDate = ts => (ts ? new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '–');

export const fmtAgo = ts => {
  if (!ts) return 'chưa có';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s} giây trước`;
  if (s < 3600) return `${Math.round(s / 60)} phút trước`;
  if (s < 86400) return `${Math.round(s / 3600)} giờ trước`;
  return `${Math.round(s / 86400)} ngày trước`;
};

export const SEASON_META = {
  spring: { label: 'Mùa xuân', short: 'Xuân', icon: '🌱', color: '#84cc16' },
  summer: { label: 'Mùa hè', short: 'Hè', icon: '☀️', color: '#f59e0b' },
  autumn: { label: 'Mùa thu', short: 'Thu', icon: '🍂', color: '#f97316' },
  winter: { label: 'Mùa đông', short: 'Đông', icon: '❄️', color: '#38bdf8' }
};

export const DECISION_META = {
  buy: { label: 'Mua', className: 'bg-buy/12 text-buy ring-1 ring-buy/30', dot: 'bg-buy' },
  sell: { label: 'Bán nếu đang giữ', className: 'bg-sell/12 text-sell ring-1 ring-sell/30', dot: 'bg-sell' },
  wait: { label: 'Chờ', className: 'bg-sun-400/10 text-sun-300 ring-1 ring-sun-400/25', dot: 'bg-sun-400' },
  avoid: { label: 'Không', className: 'bg-loss/10 text-loss ring-1 ring-loss/25', dot: 'bg-loss' },
  none: { label: 'Chưa đủ dữ liệu', className: 'bg-ink-800 text-fg-dim ring-1 ring-line', dot: 'bg-fg-dim' }
};

export const CONFIDENCE_LABEL = { high: 'Cao', medium: 'Vừa', low: 'Thấp' };
