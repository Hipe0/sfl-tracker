import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import FlipAdjustments, { FlipGapWarning } from './FlipAdjustments';
import FlipSessions, { FlipSessionTimer } from './FlipSessions';

// Mã FLIP chỉ lưu trong trình duyệt của chủ farm; mở khoá bằng cách thêm #flip vào URL
const KEY_STORAGE = 'sfl_flip_key';
const REFRESH_MS = 60 * 1000;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Giao diện terminal đen - đỏ: lãi màu đỏ hồng, lỗ màu xanh lơ
const C = {
  bg: '#0b0d11',
  card: '#101318',
  border: '#2a161c',
  line: '#1c2027',
  muted: '#7d8590',
  text: '#d6d9de',
  red: '#ff4d6d',
  redDim: '#8f1d33',
  amber: '#f5b83d',
  blue: '#7aa2f7',
  cyan: '#4cc3ff',
  lineChart: '#9ec5e8'
};

const readKey = () => {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
};
const writeKey = value => {
  try {
    if (value) localStorage.setItem(KEY_STORAGE, value);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* trình duyệt chặn storage: chỉ giữ trong phiên này */ }
};

const fmt = (n, digits = 2) => (n == null || Number.isNaN(n) ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const fmtPct = n => (n == null ? '–' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`);
const signColor = n => (n == null || n === 0 ? C.text : n > 0 ? C.red : C.cyan);

const RANGES = [
  { id: 'session', label: 'Phiên này' },
  { id: 'all', label: 'Tất cả' },
  { id: 'month', label: 'Tháng này' },
  { id: '30', label: '30 ngày' },
  { id: '7', label: '7 ngày' }
];

const CATEGORIES = [
  { id: 'resource', label: 'Tài nguyên' },
  { id: 'nft', label: 'NFT' },
  { id: 'all', label: 'Tất cả' }
];

// Mốc "YYYY-MM-DD" theo UTC+7, khớp với cách server gom ngày
function rangeToQuery(range) {
  if (range === 'all') return '';
  // Server tự lấy mốc mở phiên đang chạy
  if (range === 'session') return '&range=session';
  const nowVn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = d => d.toISOString().slice(0, 10);
  if (range === 'month') return `&from=${day(nowVn).slice(0, 8)}01`;
  const from = new Date(nowVn.getTime() - (Number(range) - 1) * 24 * 60 * 60 * 1000);
  return `&from=${day(from)}`;
}

// Gộp số lượng và SFL vào một ô hai dòng để bảng vừa khung, không cần kéo ngang
const COLUMNS = [
  { key: 'item', label: 'Vật phẩm', align: 'left', color: () => '#ffffff' },
  { key: 'boughtQty', label: 'Đã mua', render: r => fmt(r.boughtQty, 0), sub: r => `${fmt(r.boughtCost)} SFL` },
  { key: 'avgBuyPrice', label: 'Giá mua TB', render: r => fmt(r.avgBuyPrice, 5), color: () => C.amber },
  // Giá chợ hiện tại, dòng phụ là % chênh so với giá mua TB (bấm tiêu đề để sắp xếp theo giá)
  {
    key: 'currentPrice', label: 'Giá hiện tại', render: r => fmt(r.currentPrice, 5), color: () => C.text,
    sub: r => (r.priceChange == null ? '' : <span style={{ color: signColor(r.priceChange) }}>{fmtPct(r.priceChange)}</span>),
    title: () => 'Giá treo bán rẻ nhất trên chợ (trước thuế), so với giá mua trung bình'
  },
  {
    key: 'soldQty', label: 'Đã bán', render: r => fmt(r.soldQty, 0),
    sub: r => `${fmt(r.soldAfterTax)} sau thuế`,
    title: r => (r.nonFlipQty ? `${fmt(r.nonFlipQty, 0)} bán không có lô mua (${fmt(r.nonFlipAfterTax)} SFL)` : undefined)
  },
  { key: 'avgSellPrice', label: 'Giá bán TB', render: r => fmt(r.avgSellPrice, 5), color: () => C.red },
  { key: 'taxPaid', label: 'Thuế', render: r => fmt(r.taxPaid) },
  { key: 'realizedProfit', label: 'Lãi đã chốt', render: r => fmt(r.realizedProfit, 3), color: r => signColor(r.realizedProfit) },
  { key: 'roi', label: 'ROI', render: r => fmtPct(r.roi), color: r => signColor(r.roi) },
  { key: 'wins', label: 'Thắng / Thua', render: r => `${r.wins} / ${r.losses}`, sub: r => (r.lotsUsed ? `${r.lotsUsed} lô` : '') },
  { key: 'avgHoldDays', label: 'Giữ TB (ngày)', render: r => fmt(r.avgHoldDays, 1) },
  // Số lượng thật trong kho đồ (API inventory); dòng phụ là phần còn lại của các lô đã mua.
  // Lô mua nhiều hơn kho đồ thì phần chênh coi như đã dùng, không tính vào vốn đang giữ hay lãi/lỗ
  {
    key: 'inventoryQty', label: 'Đang giữ', render: r => fmt(r.inventoryQty, 0), color: () => C.amber,
    sub: r => [r.openQty ? `lô mua ${fmt(r.openQty, 0)} · vốn ${fmt(r.openCost)}` : '', r.usedQty ? `đã dùng ${fmt(r.usedQty, 0)}` : ''].filter(Boolean).join(' · '),
    title: r => (r.usedQty ? `Đã dùng ${fmt(r.usedQty, 0)} cái (vốn ${fmt(r.usedCost)} SFL): mua về nhưng không còn trong kho, không tính lãi/lỗ` : undefined)
  },
  { key: 'unrealizedProfit', label: 'Lãi chưa chốt', render: r => (r.unrealizedProfit == null ? '' : fmt(r.unrealizedProfit, 3)), color: r => signColor(r.unrealizedProfit) }
];

function ToggleButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider border rounded-sm transition-colors"
      style={{
        borderColor: active ? C.red : '#3a3f48',
        color: active ? C.red : C.muted,
        background: active ? 'rgba(255,77,109,0.08)' : 'transparent'
      }}
    >
      {children}
    </button>
  );
}

function KeyPrompt({ onSubmit, error }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(value.trim()); }}
      className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-4 font-mono rounded-sm border"
      style={{ background: C.bg, borderColor: C.border }}
    >
      <span className="text-sm text-white">&gt; FLIP <span style={{ color: C.muted }}>· nhập mã chủ farm</span></span>
      <input
        type="password"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="px-3 py-1.5 text-sm text-white w-full sm:w-72 rounded-sm border outline-none"
        style={{ background: '#07080b', borderColor: '#3a3f48' }}
        autoComplete="off"
      />
      <ToggleButton active onClick={() => onSubmit(value.trim())}>Mở khoá</ToggleButton>
      {error && <span className="text-sm" style={{ color: C.red }}>{error}</span>}
    </form>
  );
}

export default function FlipPanel({ farmId }) {
  const [flipKey, setFlipKey] = useState(readKey);
  const [askKey, setAskKey] = useState(() => typeof window !== 'undefined' && window.location.hash === '#flip');
  const [keyError, setKeyError] = useState(null);
  const [allowedFarms, setAllowedFarms] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('all');
  const [category, setCategory] = useState('resource');
  const [sort, setSort] = useState({ key: 'realizedProfit', dir: -1 });
  const [filter, setFilter] = useState('');

  const [schedule, setSchedule] = useState(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [sessionBusy, setSessionBusy] = useState(false);
  // Đang có phiên mở thì lần tải đầu tự chuyển sang "Phiên này"; người dùng tự chọn khoảng thì thôi
  const rangeTouched = useRef(false);

  const flipFetch = useCallback((path, { key = flipKey, method = 'GET', body } = {}) =>
    fetch(`${API_URL}/api/flip${path}`, {
      method,
      headers: { 'x-flip-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    }), [flipKey]);

  // Kiểm tra mã đã lưu; sai mã hoặc server tắt FLIP thì quên mã và ẩn panel
  const unlock = useCallback(async key => {
    if (!key) return;
    try {
      const res = await flipFetch('/status', { key });
      if (!res.ok) throw new Error('bad key');
      const data = await res.json();
      writeKey(key);
      setFlipKey(key);
      setAllowedFarms(data.data?.farms || []);
      setAskKey(false);
      setKeyError(null);
    } catch {
      writeKey('');
      setFlipKey('');
      setAllowedFarms(null);
      setKeyError('Mã không đúng hoặc server chưa bật FLIP');
    }
  }, [flipFetch]);

  useEffect(() => {
    if (flipKey) unlock(flipKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHash = () => { if (window.location.hash === '#flip') setAskKey(true); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const enabled = !!flipKey && !!allowedFarms && allowedFarms.includes(String(farmId));

  const loadReport = useCallback(async () => {
    if (!enabled) return;
    try {
      setLoading(true);
      const res = await flipFetch(`/${farmId}?category=${category}${rangeToQuery(range)}`);
      if (res.status === 404) { setAllowedFarms(null); return; }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || `Lỗi ${res.status}`);
      setReport(data.data);
      setSchedule(data.data.schedule || null);
      if (!rangeTouched.current) {
        rangeTouched.current = true;
        if (data.data.session && range !== 'session') setRange('session');
      }
      setError(null);
    } catch (e) {
      setError(e instanceof TypeError ? 'Không kết nối được server, sẽ thử lại sau 1 phút' : e.message);
    } finally {
      setLoading(false);
    }
  }, [enabled, farmId, category, range, flipFetch]);

  useEffect(() => {
    loadReport();
    if (!enabled) return undefined;
    const timer = setInterval(loadReport, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadReport, enabled]);

  const rows = useMemo(() => {
    if (!report) return [];
    const q = filter.trim().toLowerCase();
    return report.resources
      .filter(r => !q || r.item.toLowerCase().includes(q))
      .sort((a, b) => {
        const va = a[sort.key];
        const vb = b[sort.key];
        if (typeof va === 'string') return va.localeCompare(vb) * sort.dir;
        return ((va ?? -Infinity) - (vb ?? -Infinity)) * sort.dir;
      });
  }, [report, sort, filter]);

  if (askKey && !enabled) return <KeyPrompt onSubmit={unlock} error={keyError} />;
  if (!enabled) return null;

  const s = report?.summary;
  const rangeLabel = RANGES.find(r => r.id === range)?.label;
  const session = report?.session;
  const pickRange = id => { rangeTouched.current = true; setRange(id); };
  const kpis = s ? [
    { label: `Lãi đã chốt · ${rangeLabel}`, value: fmt(s.realizedProfit), color: signColor(s.realizedProfit) },
    { label: 'Thuế đã trả', value: fmt(s.taxPaid), color: C.red },
    { label: 'Bán sau thuế', value: fmt(s.soldAfterTax), color: C.red },
    { label: 'Đã mua', value: fmt(s.bought), color: C.amber },
    { label: 'Bán ngoài flip (sau thuế)', value: fmt(s.nonFlipAfterTax), color: C.blue },
    { label: 'ROI', value: fmtPct(s.roi), color: signColor(s.roi) },
    { label: 'Tỉ lệ thắng', value: s.winRate == null ? '–' : `${Math.round(s.winRate * 100)}%`, color: C.text },
    { label: 'Giữ TB (ngày)', value: fmt(s.avgHoldDays, 1), color: C.text },
    { label: 'Vốn đang giữ', value: fmt(s.openCost), color: C.amber },
    { label: 'Vốn hàng đã dùng', value: fmt(s.usedCost), color: C.muted },
    { label: 'Lãi chưa chốt', value: fmt(s.unrealizedProfit), color: signColor(s.unrealizedProfit) },
    { label: 'Lãi đã chốt (USD)', value: `$${fmt(s.realizedUsd)}`, color: signColor(s.realizedUsd) }
  ] : [];

  // Mở phiên: bảng "Phiên này" đếm từ lúc này. Chốt phiên: lưu kết quả vào lịch sử, bảng về 0
  const toggleSession = async () => {
    if (session && !window.confirm(`Chốt phiên bắt đầu lúc ${new Date(session.startedAt).toLocaleString('vi-VN', { hour12: false })}? Kết quả được lưu vào lịch sử và bảng "Phiên này" về 0.`)) return;
    setSessionBusy(true);
    try {
      const res = await flipFetch(session ? `/${farmId}/sessions/close` : `/${farmId}/sessions`, { method: 'POST', body: {} });
      const data = await res.json();
      if (!data.success && !['SESSION_OPEN', 'NO_OPEN_SESSION'].includes(data.error)) throw new Error(data.error);
      pickRange('session');
      setSessionVersion(v => v + 1);
      await loadReport();
    } catch (e) {
      setError(e.message);
    } finally {
      setSessionBusy(false);
    }
  };

  const toggleSort = key => setSort(prev => ({ key, dir: prev.key === key ? -prev.dir : -1 }));

  // Nút "Đang gom hàng": server lấy giao dịch 10 giây một lần trong 10 phút
  const manualBurst = schedule?.manualUntil && schedule.manualUntil > Date.now();
  const toggleBurst = async () => {
    try {
      const res = await flipFetch(`/${farmId}/burst`, manualBurst ? { method: 'DELETE' } : { method: 'POST', body: { minutes: 10 } });
      const data = await res.json();
      if (data.success) setSchedule(data.data);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="font-mono rounded-sm border overflow-hidden" style={{ background: C.bg, borderColor: C.border, color: C.text }}>
      {/* Thanh tiêu đề */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: C.line }}>
        <div>
          <div className="text-white font-bold tracking-wide"><span style={{ color: C.red }}>&gt;</span> FLIP</div>
          <div className="text-[11px]" style={{ color: C.muted }}>
            Ghép lô FIFO · tự làm mới mỗi phút
            {schedule && (
              <span style={{ color: schedule.mode === 'fast' ? C.red : C.muted }}>
                {' · '}lấy giao dịch {schedule.mode === 'fast' ? 'nhanh (10 giây)' : 'thường (1 phút)'}
                {manualBurst && ` đến ${new Date(schedule.manualUntil).toLocaleTimeString()}`}
              </span>
            )}
            {report?.sync?.lastSuccessAt && ` · đồng bộ lúc ${new Date(report.sync.lastSuccessAt).toLocaleTimeString()}`}
            {report?.sync?.lastError && <span style={{ color: C.red }}> · lỗi đồng bộ: {report.sync.lastError}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleButton
            active={!!session}
            onClick={toggleSession}
            title={session ? 'Chốt sổ phiên đang chạy, lưu vào lịch sử rồi đưa bảng về 0' : 'Bắt đầu ghi nhận mua bán từ lúc này'}
          >
            {sessionBusy ? '...' : session ? <>Chốt phiên · <FlipSessionTimer startedAt={session.startedAt} /></> : 'Mở phiên'}
          </ToggleButton>
          <ToggleButton active={manualBurst} onClick={toggleBurst} title="Lấy giao dịch 10 giây một lần trong 10 phút để không sót lệnh khi gom hàng">
            {manualBurst ? 'Dừng gom hàng' : 'Đang gom hàng'}
          </ToggleButton>
          <span className="w-px h-5 mx-1" style={{ background: C.line }} />
          {CATEGORIES.map(c => (
            <ToggleButton key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</ToggleButton>
          ))}
          <span className="w-px h-5 mx-1" style={{ background: C.line }} />
          {RANGES.map(r => (
            <ToggleButton key={r.id} active={range === r.id} onClick={() => pickRange(r.id)}>{r.label}</ToggleButton>
          ))}
          <span className="px-2 py-1 text-[11px] border rounded-sm" style={{ borderColor: '#3a3f48', color: C.muted }}>UTC+7</span>
          <ToggleButton active onClick={loadReport}>{loading ? '...' : 'Tải lại'}</ToggleButton>
          <ToggleButton onClick={() => { writeKey(''); setFlipKey(''); setAllowedFarms(null); }} title="Quên mã trên trình duyệt này">Khoá</ToggleButton>
        </div>
      </div>

      {error && <div className="px-4 py-2 text-sm" style={{ color: C.red }}>{error}</div>}
      {!report && loading && <div className="px-4 py-6 text-sm animate-pulse" style={{ color: C.muted }}>Đang tính FIFO...</div>}

      {report && (
        <>
          <FlipGapWarning report={report} colors={C} />
          {range === 'session' && (
            <div className="px-4 py-2 text-xs border-b" style={{ borderColor: C.border, color: C.muted }}>
              {session
                ? <>Phiên mở lúc <span style={{ color: C.text }}>{new Date(session.startedAt).toLocaleString('vi-VN', { hour12: false })}</span>: chỉ tính các lệnh khớp từ lúc đó. Hàng bán ra vẫn ghép với lô mua cũ nhất (kể cả lô mua trước phiên) để tính đúng giá vốn.</>
                : <>Chưa mở phiên nào, mọi số đang là 0. Bấm <span style={{ color: C.red }}>Mở phiên</span> để bắt đầu ghi nhận.</>}
            </div>
          )}
          {/* Ô tổng */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12 gap-px" style={{ background: C.bg }}>
            {kpis.map(k => (
              <div key={k.label} className="px-3 py-4 text-center flex flex-col justify-center" style={{ background: C.card, boxShadow: `inset 0 0 0 1px ${C.border}` }}>
                <div className="text-[10px] uppercase tracking-[0.18em] leading-tight" style={{ color: C.muted }}>{k.label}</div>
                <div className="text-2xl font-bold mt-1" style={{ color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Biểu đồ lãi luỹ kế + cột theo ngày */}
          <div className="h-56 px-2 pt-3 border-y" style={{ borderColor: C.border, background: '#0e1015' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={C.line} vertical={false} />
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} stroke={C.muted} fontSize={10} tickLine={false} />
                <YAxis yAxisId="day" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis yAxisId="cum" orientation="right" stroke={C.muted} fontSize={10} tickLine={false} axisLine={false} />
                <ReferenceLine yAxisId="day" y={0} stroke="#3a3f48" />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255,77,109,0.06)' }}
                  contentStyle={{ background: '#07080b', border: `1px solid ${C.border}`, borderRadius: 2, fontFamily: 'monospace', fontSize: 12 }}
                  labelStyle={{ color: C.muted }}
                  itemStyle={{ color: C.text }}
                  formatter={(v, name) => [fmt(v, 3), name === 'cumulativeProfit' ? 'Lãi luỹ kế' : 'Lãi trong ngày']}
                />
                <Bar yAxisId="day" dataKey="realizedProfit" fill={C.redDim} maxBarSize={30}>
                  {report.daily.map(d => <Cell key={d.date} fill={d.realizedProfit >= 0 ? C.redDim : '#1f4e6b'} />)}
                </Bar>
                <Line yAxisId="cum" dataKey="cumulativeProfit" stroke={C.lineChart} dot={false} strokeWidth={1.5} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Bảng theo vật phẩm */}
          <div className="flex items-center gap-3 px-4 py-2">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="lọc vật phẩm..."
              className="px-3 py-1 text-xs text-white w-56 rounded-sm border outline-none"
              style={{ background: '#07080b', borderColor: '#3a3f48' }}
            />
            <span className="text-[11px]" style={{ color: C.muted }}>{rows.length} vật phẩm · {report.lots.length} lô đã chốt · {report.openLots.length} lô đang giữ</span>
          </div>

          <div className="max-h-[520px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10" style={{ background: '#12151b' }}>
                <tr>
                  {COLUMNS.map(c => (
                    <th key={c.key} onClick={() => toggleSort(c.key)}
                      className={`px-1.5 py-2 cursor-pointer select-none uppercase tracking-wide text-[10px] leading-tight font-semibold border-b align-bottom ${c.align === 'left' ? 'text-left' : 'text-right'}`}
                      style={{ color: sort.key === c.key ? C.red : C.muted, borderColor: C.border }}>
                      {c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.item} className="hover:bg-white/5" style={{ background: i % 2 ? '#0d0f13' : C.bg }}>
                    {COLUMNS.map(c => {
                      const sub = c.sub ? c.sub(r) : '';
                      return (
                        <td key={c.key}
                          title={c.title ? c.title(r) : undefined}
                          className={`px-1.5 py-1 whitespace-nowrap ${c.align === 'left' ? 'text-left font-semibold' : 'text-right'}`}
                          style={{ color: c.color ? c.color(r) : C.text }}>
                          {c.render ? c.render(r) : r[c.key]}
                          {c.key === 'soldQty' && r.nonFlipQty > 0 && <span style={{ color: C.blue }}> *</span>}
                          {sub && <div className="text-[10px]" style={{ color: C.muted }}>{sub}</div>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[10px]" style={{ color: C.muted }}>
            <span style={{ color: C.blue }}>*</span> có phần bán không khớp lô mua nào (đồ tự farm), rê chuột để xem số lượng
          </div>
          <FlipSessions farmId={farmId} flipFetch={flipFetch} version={sessionVersion} colors={C} />
          <FlipAdjustments report={report} farmId={farmId} flipFetch={flipFetch} onChanged={loadReport} colors={C} />
        </>
      )}
    </div>
  );
}
