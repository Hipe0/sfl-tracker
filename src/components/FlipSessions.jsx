import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getTradeResourceNames, isTradeResource } from '../utils/taxCalculator';

// Tạm thời cho chốt phiên cả những mặt hàng chưa mở phiên (để chốt giao dịch hôm trước).
// Đổi thành false để danh sách "Chốt phiên" chỉ còn các mặt hàng đang mở phiên.
const CLOSE_ANY_ITEM = true;
const MAX_RESULTS = 60;
const TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7, khớp với server
const DAY_MS = 24 * 60 * 60 * 1000;

// Bảng FLIP chỉ theo dõi Tài nguyên (Resource)
const ALL_ITEMS = getTradeResourceNames().sort((a, b) => a.localeCompare(b));

const fmtNum = (n, digits = 2) => (n == null ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const fmtPct = n => (n == null ? '–' : `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`);
const fmtTime = ts => (ts ? new Date(ts).toLocaleString('vi-VN', { hour12: false }) : '–');

function fmtDuration(ms) {
  if (!(ms > 0)) return '0 phút';
  const minutes = Math.floor(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) return `${Math.floor(h / 24)} ngày ${h % 24} giờ`;
  return h ? `${h} giờ ${m} phút` : `${m} phút`;
}

// 00:00 hôm qua theo UTC+7
const startOfYesterday = () => Math.floor((Date.now() + TZ_OFFSET_MS) / DAY_MS) * DAY_MS - DAY_MS - TZ_OFFSET_MS;

// "YYYY-MM-DDTHH:mm" theo giờ máy, cho ô datetime-local
const toLocalInput = ts => new Date(ts - new Date(ts).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/**
 * Thời gian một phiên đã chạy
 */
export function FlipSessionAge({ startedAt }) {
  return <>{fmtDuration(Date.now() - startedAt)}</>;
}

/**
 * Hai nút "Mở phiên" và "Chốt phiên", mỗi nút mở một ô tìm kiếm mặt hàng.
 * Mở phiên: hàng đang giữ lên đầu (mặc định tính lùi từ lô mua cũ nhất còn giữ), sau đó mọi mặt hàng.
 * Chốt phiên: mặt hàng đang mở phiên lên đầu, tạm thời hiện cả các mặt hàng khác.
 */
export function FlipSessionControls({ farmId, flipFetch, openSessions, held = [], extraItems = [], onChanged, colors: C, Button }) {
  const [mode, setMode] = useState(null); // 'open' | 'close' | null
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [startAt, setStartAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const openByItem = useMemo(() => new Map((openSessions || []).map(s => [s.item, s])), [openSessions]);
  const heldResources = useMemo(() => held.filter(h => isTradeResource(h.item)), [held]);
  const heldByItem = useMemo(() => new Map(heldResources.map(h => [h.item, h])), [heldResources]);
  const names = useMemo(() => [...new Set([...ALL_ITEMS, ...extraItems.filter(isTradeResource)])].sort((a, b) => a.localeCompare(b)), [extraItems]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = names;
    if (mode === 'open') {
      const heldNames = heldResources.map(h => h.item);
      list = [...heldNames, ...names.filter(n => !heldByItem.has(n))];
    }
    if (mode === 'close') {
      const openNames = [...openByItem.keys()].sort((a, b) => a.localeCompare(b));
      list = CLOSE_ANY_ITEM ? [...openNames, ...names.filter(n => !openByItem.has(n))] : openNames;
    }
    return list.filter(n => !q || n.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [names, query, mode, openByItem, heldResources, heldByItem]);

  const toggle = next => {
    setMode(m => (m === next ? null : next));
    setQuery('');
    setPicked(null);
    setError(null);
  };

  const send = async (path, body) => {
    setBusy(true);
    setError(null);
    try {
      const res = await flipFetch(path, { method: 'POST', body });
      const data = await res.json();
      if (!data.success && data.error !== 'SESSION_OPEN') {
        throw new Error(data.fields ? `Kiểm tra lại: ${data.fields.join(', ')}` : data.error);
      }
      setPicked(null);
      onChanged();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Hàng đang giữ: mặc định mở từ lúc mua lô cũ nhất còn giữ, để thống kê cả hàng đã mua trước đó
  const pickForOpen = item => {
    setPicked(item);
    setStartAt(toLocalInput(heldByItem.get(item)?.oldestBuyAt ?? Date.now()));
  };

  const openItem = item => send(`/${farmId}/sessions`, { item, startedAt: new Date(startAt).getTime() });

  const pickForClose = item => {
    setPicked(item);
    setStartAt(toLocalInput(startOfYesterday()));
  };

  const closeItem = item => {
    const open = openByItem.get(item);
    const body = open ? { item } : { item, startedAt: new Date(startAt).getTime() };
    return send(`/${farmId}/sessions/close`, body);
  };

  const input = 'px-2 py-1 text-xs text-white rounded-sm border outline-none';
  const inputStyle = { background: '#07080b', borderColor: '#3a3f48' };

  return (
    <>
      <Button active={mode === 'open'} onClick={() => toggle('open')} title="Chọn mặt hàng để bắt đầu thống kê từ lúc này">Mở phiên</Button>
      <Button active={mode === 'close'} onClick={() => toggle('close')} title="Chốt phiên của một mặt hàng và lưu vào lịch sử">
        Chốt phiên{openByItem.size ? ` (${openByItem.size})` : ''}
      </Button>

      {mode && (
        <div className="w-full mt-2 p-3 rounded-sm border space-y-2" style={{ borderColor: C.border, background: '#07080b' }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider" style={{ color: C.red }}>
              {mode === 'open' ? 'Mở phiên' : 'Chốt phiên'}
            </span>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="tìm tên mặt hàng..."
              className={`${input} w-64`}
              style={inputStyle}
            />
            <span className="text-[10px]" style={{ color: C.muted }}>
              {mode === 'open' ? 'Hàng đang giữ ở đầu danh sách, bấm một mặt hàng rồi chọn giờ bắt đầu' : 'Mặt hàng đang mở phiên ở đầu danh sách'}
            </span>
            {busy && <span className="text-[10px]" style={{ color: C.muted }}>đang xử lý...</span>}
          </div>
          {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}

          <div className="max-h-64 overflow-y-auto text-xs">
            {!results.length && <div style={{ color: C.muted }}>Không có mặt hàng nào khớp.</div>}
            {results.map(item => {
              const open = openByItem.get(item);
              if (mode === 'open') {
                const h = heldByItem.get(item);
                const isPickedOpen = picked === item;
                return (
                  <div key={item} className="px-2 py-1 hover:bg-white/5">
                    <button
                      type="button"
                      disabled={!!open || busy}
                      onClick={() => (isPickedOpen ? setPicked(null) : pickForOpen(item))}
                      className="w-full flex justify-between text-left disabled:cursor-default"
                      style={{ color: open ? C.muted : C.text }}
                    >
                      <span>{item}</span>
                      {open
                        ? <span>đang mở từ {fmtTime(open.startedAt)}</span>
                        : h && <span style={{ color: C.amber }}>đang giữ {fmtNum(h.qty, 0)} · vốn {fmtNum(h.cost)} · mua từ {fmtTime(h.oldestBuyAt)}</span>}
                    </button>
                    {isPickedOpen && !open && (
                      <div className="flex flex-wrap items-center gap-2 mt-1 pl-2" style={{ color: C.muted }}>
                        <label className="flex items-center gap-2">
                          Tính từ
                          <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={input} style={inputStyle} />
                        </label>
                        {h && <span>(mặc định là lúc mua lô cũ nhất còn giữ)</span>}
                        <Button active onClick={() => openItem(item)}>{busy ? '...' : 'Mở'}</Button>
                      </div>
                    )}
                  </div>
                );
              }
              const isPicked = picked === item;
              return (
                <div key={item} className="px-2 py-1 hover:bg-white/5">
                  <button type="button" onClick={() => (isPicked ? setPicked(null) : pickForClose(item))} className="w-full flex justify-between text-left">
                    <span style={{ color: open ? '#fff' : C.text }}>{item}</span>
                    <span style={{ color: open ? C.amber : C.muted }}>
                      {open ? `mở ${fmtTime(open.startedAt)} · ${fmtDuration(Date.now() - open.startedAt)}` : 'chưa mở phiên'}
                    </span>
                  </button>
                  {isPicked && (
                    <div className="flex flex-wrap items-center gap-2 mt-1 pl-2" style={{ color: C.muted }}>
                      {open ? (
                        <span>Chốt phiên {item}, tính các lệnh khớp từ {fmtTime(open.startedAt)} đến giờ.</span>
                      ) : (
                        <label className="flex items-center gap-2">
                          Tính từ
                          <input type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} className={input} style={inputStyle} />
                          đến giờ
                        </label>
                      )}
                      <Button active onClick={() => closeItem(item)}>{busy ? '...' : 'Chốt'}</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Lịch sử các phiên đã chốt, mỗi dòng là một mặt hàng
 * @param {number} props.version Đổi giá trị để tải lại (sau khi mở/chốt phiên)
 */
export default function FlipSessions({ farmId, flipFetch, version, colors: C }) {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await flipFetch(`/${farmId}/sessions`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSessions(data.data.filter(s => s.status === 'closed'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [farmId, flipFetch]);

  useEffect(() => { load(); }, [load, version]);

  const remove = async s => {
    if (!window.confirm(`Xoá phiên ${s.item} (${fmtTime(s.startedAt)}) khỏi lịch sử?`)) return;
    const res = await flipFetch(`/${farmId}/sessions/${s.id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const q = filter.trim().toLowerCase();
  const rows = sessions.filter(s => !q || s.item.toLowerCase().includes(q));
  const signColor = n => (n == null || n === 0 ? C.text : n > 0 ? C.red : C.cyan);
  const th = 'px-1.5 py-1.5 uppercase tracking-wide text-[10px] font-semibold border-b text-right';
  const td = 'px-1.5 py-1 whitespace-nowrap text-right';
  const headers = ['Đã mua', 'Giá mua TB', 'Đã bán', 'Giá bán TB', 'Sau thuế', 'Thuế', 'Lãi đã chốt', 'ROI', 'Thắng / Thua'];

  return (
    <div className="border-t" style={{ borderColor: C.border }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wider"
        style={{ color: C.muted }}
      >
        <span>
          <span style={{ color: C.red }}>{open ? '▾' : '▸'}</span> Lịch sử phiên ({sessions.length})
        </span>
        <span className="normal-case tracking-normal">kết quả lưu lúc chốt phiên</span>
      </button>

      {open && (
        <div className="px-4 pb-4 overflow-x-auto space-y-2">
          {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
          {sessions.length > 0 && (
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="lọc mặt hàng..."
              className="px-3 py-1 text-xs text-white w-56 rounded-sm border outline-none"
              style={{ background: '#07080b', borderColor: '#3a3f48' }}
            />
          )}
          {!sessions.length && <div className="text-xs" style={{ color: C.muted }}>Chưa có phiên nào được chốt.</div>}
          {rows.length > 0 && (
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ color: C.muted }}>
                  <th className={`${th} text-left`} style={{ borderColor: C.border }}>Mặt hàng</th>
                  <th className={`${th} text-left`} style={{ borderColor: C.border }}>Phiên</th>
                  {headers.map(h => <th key={h} className={th} style={{ borderColor: C.border }}>{h}</th>)}
                  <th className={th} style={{ borderColor: C.border }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const r = s.result || {};
                  return (
                    <tr key={s.id} className="hover:bg-white/5" style={{ background: i % 2 ? '#0d0f13' : C.bg }}>
                      <td className={`${td} text-left font-semibold`} style={{ color: '#fff' }}>{s.item}</td>
                      <td className={`${td} text-left`}>
                        {fmtTime(s.startedAt)} → {fmtTime(s.endedAt)}
                        <div className="text-[10px]" style={{ color: C.muted }}>{fmtDuration(s.endedAt - s.startedAt)}</div>
                      </td>
                      <td className={td}>
                        {fmtNum(r.boughtQty, 0)}
                        <div className="text-[10px]" style={{ color: C.muted }}>{fmtNum(r.boughtCost)} SFL</div>
                      </td>
                      <td className={td} style={{ color: C.amber }}>{fmtNum(r.avgBuyPrice, 5)}</td>
                      <td className={td}>{fmtNum(r.soldQty, 0)}</td>
                      <td className={td} style={{ color: C.red }}>{fmtNum(r.avgSellPrice, 5)}</td>
                      <td className={td}>{fmtNum(r.soldAfterTax)}</td>
                      <td className={td}>{fmtNum(r.taxPaid)}</td>
                      <td className={td} style={{ color: signColor(r.realizedProfit) }}>{fmtNum(r.realizedProfit, 3)}</td>
                      <td className={td} style={{ color: signColor(r.roi) }}>{fmtPct(r.roi)}</td>
                      <td className={td}>{r.wins ?? 0} / {r.losses ?? 0}</td>
                      <td className={td}>
                        <button type="button" onClick={() => remove(s)} style={{ color: C.muted }} title="Xoá phiên khỏi lịch sử">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
