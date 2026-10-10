import React, { useState } from 'react';

const SIDE_LABEL = { buy: 'Mua', sell: 'Bán' };
const SOURCE_LABEL = { estimate: 'Ước tính', manual: 'Nhập tay' };
const GAP_REASON = {
  missing_snapshot: 'chưa có ảnh chụp kho đồ',
  no_inventory_change: 'kho đồ không đổi',
  balance_mismatch: 'số dư FLOWER không khớp',
  price_mismatch: 'giá lệch quá xa thị trường',
  no_reference_price: 'không có giá tham chiếu'
};

const fmtNum = (n, digits = 2) => (n == null ? '–' : Number(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const fmtTime = ts => (ts ? new Date(ts).toLocaleString('vi-VN', { hour12: false }) : '–');

// "YYYY-MM-DDTHH:mm" theo giờ máy, cho ô datetime-local
const toLocalInput = ts => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const emptyForm = () => ({ id: null, item: '', side: 'buy', qty: '', price: '', at: toLocalInput(Date.now()), note: '' });

/**
 * Cảnh báo giao dịch có thể bị sót (API chỉ trả 50 lệnh gần nhất)
 */
export function FlipGapWarning({ report, colors: C }) {
  const w = report?.warnings;
  const open = (report?.gaps || []).filter(g => g.status !== 'resolved');
  if (!w || (!open.length && !w.estimatedAdjustments)) return null;
  return (
    <div className="px-4 py-2 text-xs border-b space-y-1" style={{ borderColor: C.border, background: 'rgba(245,184,61,0.06)' }}>
      {open.length > 0 && (
        <div style={{ color: C.amber }}>
          ⚠ Có {open.length} khoảng có thể bị sót giao dịch
          {w.missingTrades > 0 && <> (khoảng {w.missingTrades} lệnh)</>}. Lãi/lỗ quanh các khoảng này có thể chưa đúng, hãy thêm lệnh tay ở bảng "Lệnh bù & nhập tay".
          <div className="mt-1" style={{ color: C.muted }}>
            {open.slice(0, 5).map(g => (
              <div key={g.id}>
                · {fmtTime(g.from)} → {fmtTime(g.to)}
                {g.missingCount ? `, thiếu ${g.missingCount} lệnh` : ''}
                {g.status === 'pending' ? ', đang chờ ảnh chụp kho để tự bù' : g.reason ? `, không tự bù được (${GAP_REASON[g.reason] || g.reason})` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
      {w.estimatedAdjustments > 0 && (
        <div style={{ color: C.muted }}>
          Có {w.estimatedAdjustments} lệnh được tự bù theo kho đồ và số dư (đánh dấu "Ước tính"). Bạn có thể sửa hoặc xoá ở bảng bên dưới.
        </div>
      )}
    </div>
  );
}

/**
 * Bảng lệnh bù (ước tính) và lệnh nhập tay, kèm form thêm/sửa
 */
export default function FlipAdjustments({ report, farmId, flipFetch, onChanged, colors: C }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const adjustments = report?.adjustments || [];
  const itemNames = (report?.resources || []).map(r => r.item);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  // Hệ thống tự tính tổng = số lượng × giá
  const total = (Number(form.qty) || 0) * (Number(form.price) || 0);

  const submit = async e => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        item: form.item.trim(),
        side: form.side,
        qty: Number(form.qty),
        price: Number(form.price),
        at: new Date(form.at).getTime(),
        note: form.note
      };
      const path = form.id ? `/${farmId}/adjustments/${form.id}` : `/${farmId}/adjustments`;
      const res = await flipFetch(path, { method: form.id ? 'PATCH' : 'POST', body });
      const data = await res.json();
      if (!data.success) throw new Error(data.fields ? `Kiểm tra lại: ${data.fields.join(', ')}` : data.error);
      setForm(emptyForm());
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async adj => {
    if (!window.confirm(`Xoá lệnh ${SIDE_LABEL[adj.side].toLowerCase()} ${fmtNum(adj.qty, 0)} ${adj.item}?`)) return;
    const res = await flipFetch(`/${farmId}/adjustments/${adj.id}`, { method: 'DELETE' });
    if (res.ok) onChanged();
  };

  const edit = adj => {
    setOpen(true);
    setForm({ id: adj.id, item: adj.item, side: adj.side, qty: String(adj.qty), price: String(adj.price ?? ''), at: toLocalInput(adj.at), note: adj.note || '' });
  };

  const input = 'px-2 py-1 text-xs text-white rounded-sm border outline-none';
  const inputStyle = { background: '#07080b', borderColor: '#3a3f48' };

  return (
    <div className="border-t" style={{ borderColor: C.border }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wider"
        style={{ color: C.muted }}
      >
        <span>
          <span style={{ color: C.red }}>{open ? '▾' : '▸'}</span> Lệnh bù & nhập tay ({adjustments.length})
        </span>
        <span className="normal-case tracking-normal">dùng khi API sót giao dịch</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[10px]" style={{ color: C.muted }}>
              Thời gian
              <input type="datetime-local" value={form.at} onChange={set('at')} className={input} style={inputStyle} required />
            </label>
            <label className="flex flex-col gap-1 text-[10px]" style={{ color: C.muted }}>
              Vật phẩm
              <input list="flip-items" value={form.item} onChange={set('item')} className={`${input} w-36`} style={inputStyle} required />
              <datalist id="flip-items">{itemNames.map(n => <option key={n} value={n} />)}</datalist>
            </label>
            <label className="flex flex-col gap-1 text-[10px]" style={{ color: C.muted }}>
              Loại
              <select value={form.side} onChange={set('side')} className={input} style={inputStyle}>
                <option value="buy">Mua</option>
                <option value="sell">Bán</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[10px]" style={{ color: C.muted }}>
              Số lượng
              <input type="number" min="0" step="any" value={form.qty} onChange={set('qty')} className={`${input} w-28`} style={inputStyle} required />
            </label>
            <label className="flex flex-col gap-1 text-[10px]" style={{ color: C.muted }}>
              {form.side === 'sell' ? 'Giá bán (mỗi cái)' : 'Giá mua (mỗi cái)'}
              <input type="number" min="0" step="any" value={form.price} onChange={set('price')} className={`${input} w-28`} style={inputStyle} required />
            </label>
            <div className="flex flex-col gap-1 text-[10px] pb-1" style={{ color: C.muted }}>
              Tổng SFL
              <span className="text-xs" style={{ color: C.text }}>
                {total > 0 ? fmtNum(total, 4) : '–'}
                {form.side === 'sell' && total > 0 && <span style={{ color: C.muted }}> (trước thuế, tự trừ thuế)</span>}
              </span>
            </div>
            <label className="flex flex-col gap-1 text-[10px] flex-1 min-w-[140px]" style={{ color: C.muted }}>
              Ghi chú
              <input value={form.note} onChange={set('note')} className={input} style={inputStyle} maxLength={200} />
            </label>
            <button type="submit" disabled={saving}
              className="px-3 py-1 text-[11px] uppercase tracking-wider border rounded-sm"
              style={{ borderColor: C.red, color: C.red, background: 'rgba(255,77,109,0.08)' }}>
              {saving ? '...' : form.id ? 'Lưu' : 'Thêm'}
            </button>
            {form.id && (
              <button type="button" onClick={() => setForm(emptyForm())}
                className="px-3 py-1 text-[11px] uppercase tracking-wider border rounded-sm"
                style={{ borderColor: '#3a3f48', color: C.muted }}>
                Huỷ
              </button>
            )}
          </form>
          {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}

          {adjustments.length > 0 && (
            <div className="overflow-x-auto max-h-72 overflow-y-auto border rounded-sm" style={{ borderColor: C.line }}>
              <table className="w-full text-[11px]">
                <thead className="sticky top-0" style={{ background: '#12151b', color: C.muted }}>
                  <tr className="uppercase tracking-wide text-[10px]">
                    <th className="px-2 py-1.5 text-left">Thời gian</th>
                    <th className="px-2 py-1.5 text-left">Vật phẩm</th>
                    <th className="px-2 py-1.5 text-left">Loại</th>
                    <th className="px-2 py-1.5 text-right">Số lượng</th>
                    <th className="px-2 py-1.5 text-right">Giá</th>
                    <th className="px-2 py-1.5 text-right">Tổng SFL</th>
                    <th className="px-2 py-1.5 text-left">Nguồn</th>
                    <th className="px-2 py-1.5 text-left">Ghi chú</th>
                    <th className="px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map(a => (
                    <tr key={a.id} className="border-t" style={{ borderColor: C.line }}>
                      <td className="px-2 py-1 whitespace-nowrap">{fmtTime(a.at)}</td>
                      <td className="px-2 py-1 font-semibold text-white">{a.item}</td>
                      <td className="px-2 py-1" style={{ color: a.side === 'buy' ? C.amber : C.red }}>{SIDE_LABEL[a.side]}</td>
                      <td className="px-2 py-1 text-right">{fmtNum(a.qty, 0)}</td>
                      <td className="px-2 py-1 text-right">{fmtNum(a.price, 5)}</td>
                      <td className="px-2 py-1 text-right" title={a.side === 'sell' && a.source === 'manual' ? 'Trước thuế' : a.side === 'sell' ? 'Sau thuế' : undefined}>{fmtNum(a.sfl, 3)}</td>
                      <td className="px-2 py-1" style={{ color: a.source === 'estimate' ? C.amber : C.blue }}>{SOURCE_LABEL[a.source] || a.source}</td>
                      <td className="px-2 py-1" style={{ color: C.muted }}>{a.note}</td>
                      <td className="px-2 py-1 whitespace-nowrap text-right">
                        <button type="button" onClick={() => edit(a)} className="mr-2 underline" style={{ color: C.muted }}>Sửa</button>
                        <button type="button" onClick={() => remove(a)} className="underline" style={{ color: C.red }}>Xoá</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
