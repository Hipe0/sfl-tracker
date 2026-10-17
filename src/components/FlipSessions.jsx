import React, { useState, useEffect, useCallback } from 'react';

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

/**
 * Thời gian phiên đang chạy, hiển thị trên nút "Chốt phiên"
 */
export function FlipSessionTimer({ startedAt }) {
  return <>{fmtDuration(Date.now() - startedAt)}</>;
}

/**
 * Lịch sử các phiên đã chốt; bấm một dòng để xem từng vật phẩm của phiên đó
 * @param {number} props.version Đổi giá trị để tải lại (sau khi mở/chốt phiên)
 */
export default function FlipSessions({ farmId, flipFetch, version, colors: C }) {
  const [sessions, setSessions] = useState([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
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
    if (!window.confirm(`Xoá phiên ${fmtTime(s.startedAt)} khỏi lịch sử?`)) return;
    const res = await flipFetch(`/${farmId}/sessions/${s.id}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const th = 'px-1.5 py-1.5 uppercase tracking-wide text-[10px] font-semibold border-b text-right';
  const td = 'px-1.5 py-1 whitespace-nowrap text-right';
  const signColor = n => (n == null || n === 0 ? C.text : n > 0 ? C.red : C.cyan);

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
        <div className="px-4 pb-4 overflow-x-auto">
          {error && <div className="text-xs mb-2" style={{ color: C.red }}>{error}</div>}
          {!sessions.length && <div className="text-xs" style={{ color: C.muted }}>Chưa có phiên nào được chốt.</div>}
          {sessions.length > 0 && (
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ color: C.muted, borderColor: C.border }}>
                  <th className={`${th} text-left`} style={{ borderColor: C.border }}>Bắt đầu</th>
                  <th className={th} style={{ borderColor: C.border }}>Kết thúc</th>
                  <th className={th} style={{ borderColor: C.border }}>Thời lượng</th>
                  <th className={th} style={{ borderColor: C.border }}>Đã mua</th>
                  <th className={th} style={{ borderColor: C.border }}>Bán sau thuế</th>
                  <th className={th} style={{ borderColor: C.border }}>Thuế</th>
                  <th className={th} style={{ borderColor: C.border }}>Lãi đã chốt</th>
                  <th className={th} style={{ borderColor: C.border }}>ROI</th>
                  <th className={th} style={{ borderColor: C.border }}>Thắng / Thua</th>
                  <th className={th} style={{ borderColor: C.border }} />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => {
                  const sum = s.summary || {};
                  const isOpen = expanded === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : s.id)}
                        className="cursor-pointer hover:bg-white/5"
                        style={{ background: i % 2 ? '#0d0f13' : C.bg }}
                      >
                        <td className={`${td} text-left`} style={{ color: '#fff' }}>
                          <span style={{ color: C.red }}>{isOpen ? '▾' : '▸'}</span> {fmtTime(s.startedAt)}
                          {s.note && <div className="text-[10px]" style={{ color: C.muted }}>{s.note}</div>}
                        </td>
                        <td className={td}>{fmtTime(s.endedAt)}</td>
                        <td className={td}>{fmtDuration(s.endedAt - s.startedAt)}</td>
                        <td className={td} style={{ color: C.amber }}>{fmtNum(sum.bought)}</td>
                        <td className={td} style={{ color: C.red }}>{fmtNum(sum.soldAfterTax)}</td>
                        <td className={td}>{fmtNum(sum.taxPaid)}</td>
                        <td className={td} style={{ color: signColor(sum.realizedProfit) }}>{fmtNum(sum.realizedProfit, 3)}</td>
                        <td className={td} style={{ color: signColor(sum.roi) }}>{fmtPct(sum.roi)}</td>
                        <td className={td}>{sum.wins ?? 0} / {sum.losses ?? 0}</td>
                        <td className={td}>
                          <button type="button" onClick={e => { e.stopPropagation(); remove(s); }} style={{ color: C.muted }} title="Xoá phiên khỏi lịch sử">✕</button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr style={{ background: '#07080b' }}>
                          <td colSpan={10} className="px-4 py-2">
                            {!s.resources.length && <span style={{ color: C.muted }}>Phiên không có giao dịch nào.</span>}
                            {s.resources.length > 0 && (
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr style={{ color: C.muted }}>
                                    <th className="text-left font-normal py-1">Vật phẩm</th>
                                    <th className="text-right font-normal">Đã mua</th>
                                    <th className="text-right font-normal">Vốn</th>
                                    <th className="text-right font-normal">Giá mua TB</th>
                                    <th className="text-right font-normal">Đã bán</th>
                                    <th className="text-right font-normal">Sau thuế</th>
                                    <th className="text-right font-normal">Giá bán TB</th>
                                    <th className="text-right font-normal">Lãi đã chốt</th>
                                    <th className="text-right font-normal">ROI</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {s.resources.map(r => (
                                    <tr key={r.item}>
                                      <td className="text-left py-0.5" style={{ color: '#fff' }}>{r.item}</td>
                                      <td className="text-right">{fmtNum(r.boughtQty, 0)}</td>
                                      <td className="text-right" style={{ color: C.amber }}>{fmtNum(r.boughtCost)}</td>
                                      <td className="text-right">{fmtNum(r.avgBuyPrice, 5)}</td>
                                      <td className="text-right">{fmtNum(r.soldQty, 0)}</td>
                                      <td className="text-right" style={{ color: C.red }}>{fmtNum(r.soldAfterTax)}</td>
                                      <td className="text-right">{fmtNum(r.avgSellPrice, 5)}</td>
                                      <td className="text-right" style={{ color: signColor(r.realizedProfit) }}>{fmtNum(r.realizedProfit, 3)}</td>
                                      <td className="text-right" style={{ color: signColor(r.roi) }}>{fmtPct(r.roi)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
