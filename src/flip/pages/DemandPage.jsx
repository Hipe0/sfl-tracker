import { useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import { Card, EmptyState, ErrorNote, ItemIcon } from '../components/ui';
import { SEASON_META } from '../lib/format';
import { getTradeResourceNames } from '../../utils/taxCalculator';

const SOURCES = [
  { id: 'pet_race', label: 'Đua pet' },
  { id: 'weekly_task', label: 'Nhiệm vụ tuần (đua chế đồ)' },
  { id: 'bake', label: 'Chế bánh' },
  { id: 'craft', label: 'Chế đồ khác' },
  { id: 'other', label: 'Khác' }
];
const sourceLabel = id => SOURCES.find(s => s.id === id)?.label || id;
const RESOURCES = getTradeResourceNames().sort();
const input = 'rounded-lg border border-slate-700 bg-slate-950/70 px-2.5 py-1.5 text-sm text-white outline-none focus:border-blue-500';

function DemandForm({ flipKey, chapter, onSaved }) {
  const [source, setSource] = useState('pet_race');
  const [chapterWeek, setChapterWeek] = useState(chapter?.week || '');
  const [season, setSeason] = useState('');
  const [rows, setRows] = useState([{ item: '', qty: '' }]);
  const [note, setNote] = useState('');
  const [useInScore, setUseInScore] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const items = Object.fromEntries(rows.filter(r => r.item && Number(r.qty) > 0).map(r => [r.item, Number(r.qty)]));
      await api.addDemand(flipKey, { source, chapterWeek: chapterWeek || null, season: season || null, items, note, useInScore, chapter: chapter?.name || undefined });
      setRows([{ item: '', qty: '' }]);
      setNote('');
      onSaved();
    } catch (err) {
      setError(err.data?.fields ? Object.values(err.data.fields).join('. ') : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 p-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs text-slate-400">Nguồn
          <select className={input} value={source} onChange={e => setSource(e.target.value)}>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">Tuần chapter
          <input className={`${input} w-24`} type="number" min="1" max="20" value={chapterWeek} onChange={e => setChapterWeek(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">Mùa (nếu có)
          <select className={input} value={season} onChange={e => setSeason(e.target.value)}>
            <option value="">Không theo mùa</option>
            {Object.entries(SEASON_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
          </select>
        </label>
        <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs text-slate-400">Ghi chú
          <input className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="vd: Pet race tuần 3, mốc 2" />
        </label>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select className={`${input} w-52`} value={r.item} onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}>
              <option value="">Chọn tài nguyên...</option>
              {RESOURCES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input className={`${input} w-28`} type="number" min="0" step="any" placeholder="Số lượng" value={r.qty}
              onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
            {rows.length > 1 && <button type="button" className="text-xs text-slate-400 hover:text-rose-300" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>Xoá</button>}
          </div>
        ))}
        <button type="button" className="text-xs text-blue-300 hover:text-blue-200" onClick={() => setRows(rs => [...rs, { item: '', qty: '' }])}>+ Thêm tài nguyên</button>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={useInScore} onChange={e => setUseInScore(e.target.checked)} />
        Tính vào điểm mua (mặc định chỉ lưu để chapter sau tra lại)
      </label>
      {error && <div className="text-sm text-rose-300">{error}</div>}
      <button type="submit" disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60">{busy ? 'Đang lưu...' : 'Lưu yêu cầu'}</button>
    </form>
  );
}

/** Lịch mùa + nguyên liệu Lava Pit + yêu cầu theo chapter (đua pet, nhiệm vụ tuần, chế bánh) lưu để dùng lại */
export default function DemandPage({ flipKey, isOwner, refreshKey }) {
  const calendar = useApi(() => api.calendar(flipKey), [flipKey, refreshKey]);
  const demand = useApi(() => api.demand(flipKey), [flipKey, refreshKey]);
  const cal = calendar.data;
  const chapter = cal?.chapter;

  const remove = async id => {
    if (!window.confirm('Xoá yêu cầu này?')) return;
    try {
      await api.deleteDemand(flipKey, id);
      demand.reload();
    } catch (e) {
      window.alert(e.message);
    }
  };

  return (
    <div className="space-y-5">
      <Card title="Lịch mùa 4 tuần tới" subtitle={chapter ? `${chapter.name || 'Chapter mới (chưa khai báo tên trong src-backend/domain/chapters.cjs)'} · tuần ${chapter.week ?? '–'}` : null}>
        <ErrorNote error={calendar.error} onRetry={calendar.reload} />
        {!cal ? <EmptyState icon="⏳" title="Đang tải..." /> : (
          <div className="grid gap-px bg-slate-800/60 md:grid-cols-2 xl:grid-cols-4">
            {cal.upcoming.map((s, i) => (
              <div key={s.startedAt} className="space-y-3 bg-[#111827] p-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold" style={{ color: SEASON_META[s.season].color }}>{SEASON_META[s.season].icon} {SEASON_META[s.season].label}</span>
                  <span className="text-xs text-slate-400">{i === 0 ? 'Tuần này' : new Date(s.startedAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Lava Pit (Obsidian)</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(s.lavaPit).map(([item, qty]) => (
                      <span key={item} className="inline-flex items-center gap-1 rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[11px] text-orange-200"><ItemIcon item={item} size={16} />{item} ×{qty}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Trồng được</div>
                  <div className="flex flex-wrap gap-1">
                    {s.crops.map(c => <span key={c} className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[11px] text-slate-300"><ItemIcon item={c} size={16} />{c}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Yêu cầu theo chapter" subtitle="Đua pet, nhiệm vụ tuần, chế bánh... Đầu và cuối mỗi chapter yêu cầu thường lặp lại, lưu lại để chapter sau tra cứu.">
        <ErrorNote error={demand.error} onRetry={demand.reload} />
        {isOwner ? <DemandForm flipKey={flipKey} chapter={chapter} onSaved={demand.reload} /> : (
          <div className="px-4 py-3 text-xs text-slate-400">Chỉ chủ app (mã chủ) được thêm/xoá yêu cầu, bạn xem được danh sách bên dưới.</div>
        )}
        {!demand.data?.length ? (
          <EmptyState icon="🗒️" title="Chưa lưu yêu cầu nào">Thêm yêu cầu của tuần này ở form phía trên để chapter sau dùng lại.</EmptyState>
        ) : (
          <div className="overflow-x-auto border-t border-slate-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Nguồn</th>
                  <th className="px-3 py-2 text-left">Chapter</th>
                  <th className="px-3 py-2 text-right">Tuần</th>
                  <th className="px-3 py-2 text-left">Mùa</th>
                  <th className="px-3 py-2 text-left">Tài nguyên</th>
                  <th className="px-3 py-2 text-left">Ghi chú</th>
                  <th className="px-3 py-2 text-center">Vào điểm mua</th>
                  {isOwner && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {demand.data.map(d => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-slate-200">{sourceLabel(d.source)}</td>
                    <td className="px-3 py-2 text-slate-400">{d.chapter || '–'}</td>
                    <td className="px-3 py-2 text-right text-slate-300">{d.chapterWeek ?? '–'}</td>
                    <td className="px-3 py-2 text-slate-300">{d.season ? SEASON_META[d.season]?.label : '–'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(d.items || {}).map(([item, qty]) => <span key={item} className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[11px] text-slate-200"><ItemIcon item={item} size={14} />{item} ×{qty}</span>)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">{d.note || ''}</td>
                    <td className="px-3 py-2 text-center">{d.useInScore ? '✓' : ''}</td>
                    {isOwner && <td className="px-3 py-2 text-right"><button type="button" onClick={() => remove(d.id)} className="text-xs text-slate-400 hover:text-rose-300">Xoá</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
