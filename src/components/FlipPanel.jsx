import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';

// Mã FLIP chỉ lưu trong trình duyệt của chủ farm; mở khoá bằng cách thêm #flip vào URL
const KEY_STORAGE = 'sfl_flip_key';
const REFRESH_MS = 60 * 1000;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
const signClass = n => (n == null ? 'text-slate-300' : n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-300');

const RANGES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'month', label: 'Tháng này' },
  { id: '30', label: '30 ngày' },
  { id: '7', label: '7 ngày' }
];

// Mốc "YYYY-MM-DD" theo UTC+7, khớp với cách server gom ngày
function rangeToQuery(range) {
  if (range === 'all') return '';
  const nowVn = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = d => d.toISOString().slice(0, 10);
  if (range === 'month') return `&from=${day(nowVn).slice(0, 8)}01`;
  const from = new Date(nowVn.getTime() - (Number(range) - 1) * 24 * 60 * 60 * 1000);
  return `&from=${day(from)}`;
}

const COLUMNS = [
  { key: 'item', label: 'Resource', align: 'left' },
  { key: 'boughtQty', label: 'Bought qty', render: r => fmt(r.boughtQty, 0) },
  { key: 'boughtCost', label: 'Bought (SFL)', render: r => fmt(r.boughtCost) },
  { key: 'avgBuyPrice', label: 'Avg buy', render: r => fmt(r.avgBuyPrice, 5), cls: 'text-amber-300' },
  { key: 'soldQty', label: 'Sold qty', render: r => fmt(r.soldQty, 0) },
  { key: 'soldAfterTax', label: 'Sold after tax', render: r => fmt(r.soldAfterTax) },
  { key: 'avgSellPrice', label: 'Avg sell', render: r => fmt(r.avgSellPrice, 5), cls: 'text-rose-300' },
  { key: 'taxPaid', label: 'Tax', render: r => fmt(r.taxPaid) },
  { key: 'realizedProfit', label: 'Realized', render: r => fmt(r.realizedProfit, 3), sign: r => r.realizedProfit },
  { key: 'roi', label: 'ROI', render: r => fmtPct(r.roi), sign: r => r.roi },
  { key: 'wins', label: 'Win / Loss', render: r => `${r.wins} / ${r.losses}` },
  { key: 'avgHoldDays', label: 'Avg hold (d)', render: r => fmt(r.avgHoldDays, 1) },
  { key: 'nonFlipQty', label: 'Non-flip qty', render: r => (r.nonFlipQty ? fmt(r.nonFlipQty, 0) : '') },
  { key: 'lotsUsed', label: 'Lots', render: r => r.lotsUsed || '' },
  { key: 'openQty', label: 'Holding', render: r => (r.openQty ? fmt(r.openQty, 0) : ''), cls: 'text-amber-300' },
  { key: 'unrealizedProfit', label: 'Unrealized', render: r => (r.unrealizedProfit == null ? '' : fmt(r.unrealizedProfit, 3)), sign: r => r.unrealizedProfit }
];

function KeyPrompt({ onSubmit, error }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(value.trim()); }}
      className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4"
    >
      <span className="text-slate-300 text-sm font-semibold">FLIP · nhập mã chủ farm</span>
      <input
        type="password"
        value={value}
        onChange={e => setValue(e.target.value)}
        className="bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white w-full sm:w-72"
        autoComplete="off"
      />
      <button type="submit" className="px-4 py-1.5 rounded-md text-sm font-semibold bg-rose-600/20 text-rose-300 border border-rose-500/50">
        Mở khoá
      </button>
      {error && <span className="text-rose-400 text-sm">{error}</span>}
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

  const flipFetch = useCallback((path, key = flipKey) =>
    fetch(`${API_URL}/api/flip${path}`, { headers: { 'x-flip-key': key } }), [flipKey]);

  // Kiểm tra mã đã lưu; sai mã hoặc server tắt FLIP thì quên mã và ẩn panel
  const unlock = useCallback(async key => {
    if (!key) return;
    try {
      const res = await flipFetch('/status', key);
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
      setError(null);
    } catch (e) {
      setError(e.message);
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
  const kpis = s ? [
    { label: 'Realized', value: fmt(s.realizedProfit), cls: signClass(s.realizedProfit) },
    { label: 'Tax paid', value: fmt(s.taxPaid), cls: 'text-rose-300' },
    { label: 'Sold after tax', value: fmt(s.soldAfterTax), cls: 'text-rose-300' },
    { label: 'Bought', value: fmt(s.bought), cls: 'text-amber-300' },
    { label: 'Sold non-flip', value: fmt(s.nonFlipAfterTax), cls: 'text-sky-300' },
    { label: 'ROI', value: fmtPct(s.roi), cls: signClass(s.roi) },
    { label: 'Win rate', value: s.winRate == null ? '–' : `${Math.round(s.winRate * 100)}%`, cls: 'text-slate-100' },
    { label: 'Avg hold (days)', value: fmt(s.avgHoldDays, 1), cls: 'text-slate-100' },
    { label: 'Holding cost', value: fmt(s.openCost), cls: 'text-amber-300' },
    { label: 'Unrealized', value: fmt(s.unrealizedProfit), cls: signClass(s.unrealizedProfit) },
    { label: 'Realized (USD)', value: `$${fmt(s.realizedUsd)}`, cls: signClass(s.realizedUsd) }
  ] : [];

  const toggleSort = key => setSort(prev => ({ key, dir: prev.key === key ? -prev.dir : -1 }));

  return (
    <div className="space-y-4 bg-slate-950/60 border border-rose-900/40 rounded-2xl p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">&gt; FLIP <span className="text-xs font-normal text-slate-500">chỉ mình bạn thấy</span></h3>
          <p className="text-xs text-slate-500">
            Ghép lô FIFO · tự làm mới mỗi phút
            {report?.sync?.lastSuccessAt && ` · lưu giao dịch lần cuối ${new Date(report.sync.lastSuccessAt).toLocaleTimeString()}`}
            {report?.sync?.lastError && <span className="text-rose-400"> · lỗi đồng bộ: {report.sync.lastError}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ id: 'resource', label: 'Tài nguyên' }, { id: 'nft', label: 'NFTs' }, { id: 'all', label: 'Tất cả' }].map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold border ${category === c.id ? 'border-rose-500/60 text-rose-300 bg-rose-600/10' : 'border-slate-700 text-slate-400'}`}>
              {c.label}
            </button>
          ))}
          <span className="w-px bg-slate-700 mx-1" />
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold border ${range === r.id ? 'border-rose-500/60 text-rose-300 bg-rose-600/10' : 'border-slate-700 text-slate-400'}`}>
              {r.label}
            </button>
          ))}
          <button onClick={loadReport} className="px-3 py-1 rounded-md text-xs font-semibold border border-slate-700 text-slate-300">
            {loading ? '...' : 'Reload'}
          </button>
          <button onClick={() => { writeKey(''); setFlipKey(''); setAllowedFarms(null); }}
            className="px-3 py-1 rounded-md text-xs font-semibold border border-slate-700 text-slate-500" title="Quên mã trên trình duyệt này">
            Khoá
          </button>
        </div>
      </div>

      {error && <div className="text-rose-400 text-sm">{error}</div>}
      {!report && loading && <div className="text-slate-400 text-sm animate-pulse">Đang tính FIFO...</div>}

      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-11 gap-2">
            {kpis.map(k => (
              <div key={k.label} className="bg-slate-900/70 border border-slate-800 rounded-xl px-3 py-3 text-center">
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{k.label}</div>
                <div className={`text-xl font-bold font-mono ${k.cls}`}>{k.value}</div>
              </div>
            ))}
          </div>

          <div className="h-56 bg-slate-900/50 border border-slate-800 rounded-xl p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={report.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="day" stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="cum" orientation="right" stroke="#94a3b8" fontSize={11} />
                <ReferenceLine yAxisId="day" y={0} stroke="#334155" />
                <RechartsTooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v, name) => [fmt(v, 3), name === 'cumulativeProfit' ? 'Luỹ kế' : 'Trong ngày']}
                />
                <Bar yAxisId="day" dataKey="realizedProfit" maxBarSize={28}>
                  {report.daily.map(d => <Cell key={d.date} fill={d.realizedProfit >= 0 ? '#9f1239' : '#475569'} />)}
                </Bar>
                <Line yAxisId="cum" dataKey="cumulativeProfit" stroke="#7dd3fc" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center gap-3">
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Lọc vật phẩm..."
              className="bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-1.5 text-sm text-white w-56"
            />
            <span className="text-xs text-slate-500">{rows.length} vật phẩm · {report.lots.length} lô đã chốt · {report.openLots.length} lô đang giữ</span>
          </div>

          <div className="overflow-x-auto max-h-[480px] overflow-y-auto border border-slate-800 rounded-xl">
            <table className="min-w-full text-xs font-mono">
              <thead className="sticky top-0 bg-slate-900 text-slate-400 uppercase tracking-wider">
                <tr>
                  {COLUMNS.map(c => (
                    <th key={c.key} onClick={() => toggleSort(c.key)}
                      className={`px-3 py-2 cursor-pointer whitespace-nowrap select-none ${c.align === 'left' ? 'text-left' : 'text-right'}`}>
                      {c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.item} className="border-t border-slate-800/70 hover:bg-slate-800/40">
                    {COLUMNS.map(c => (
                      <td key={c.key}
                        className={`px-3 py-1.5 whitespace-nowrap ${c.align === 'left' ? 'text-left font-semibold text-slate-100' : 'text-right'} ${c.sign ? signClass(c.sign(r)) : (c.cls || 'text-slate-300')}`}>
                        {c.render ? c.render(r) : r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
