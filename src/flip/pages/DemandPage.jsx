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
const input = 'h-9 rounded-xl border border-line bg-ink-950 px-3 text-sm text-fg outline-none transition-colors placeholder:text-fg-dim focus:border-sun-400/60';

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
    <form onSubmit={save} className="space-y-4 border-b border-line-soft px-5 py-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-dim">Nguồn
          <select className={input} value={source} onChange={e => setSource(e.target.value)}>
            {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-dim">Tuần chapter
          <input className={`${input} num w-24`} type="number" min="1" max="20" value={chapterWeek} onChange={e => setChapterWeek(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-dim">Mùa (nếu có)
          <select className={input} value={season} onChange={e => setSeason(e.target.value)}>
            <option value="">Không theo mùa</option>
            {Object.entries(SEASON_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
          </select>
        </label>
        <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs font-medium text-fg-dim">Ghi chú
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
            <input className={`${input} num w-28`} type="number" min="0" step="any" placeholder="Số lượng" value={r.qty}
              onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
            {rows.length > 1 && <button type="button" className="text-xs text-fg-dim hover:text-loss" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>Xoá</button>}
          </div>
        ))}
        <button type="button" className="text-xs font-medium text-sun-300 hover:text-sun-400" onClick={() => setRows(rs => [...rs, { item: '', qty: '' }])}>+ Thêm tài nguyên</button>
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <input type="checkbox" className="h-4 w-4 accent-[#f7c548]" checked={useInScore} onChange={e => setUseInScore(e.target.checked)} />
        Tính vào điểm mua (mặc định chỉ lưu để chapter sau tra lại)
      </label>
      {error && <div className="text-sm text-loss">{error}</div>}
      <button type="submit" disabled={busy} className="h-9 rounded-xl bg-sun-400 px-4 text-sm font-semibold text-ink-950 transition-colors hover:bg-sun-300 disabled:opacity-60">{busy ? 'Đang lưu...' : 'Lưu yêu cầu'}</button>
    </form>
  );
}

const fmtWeekDay = iso => new Date(`${iso}T00:00:00Z`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

function Chips({ items, tone }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(items).map(([item, qty]) => (
        <span key={item} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] ${tone}`}>
          <ItemIcon item={item} size={16} />{item}<span className="num opacity-70">×{qty}</span>
        </span>
      ))}
    </div>
  );
}

/** Faction Pet (đua pet) + Kitchen tuần này và tuần sau, lấy từ lịch xoay vòng 12 tuần */
function FactionWeekCard({ flipKey, refreshKey }) {
  const fw = useApi(() => api.factionWeek(flipKey), [flipKey, refreshKey]);
  const weeks = fw.data ? [['Tuần này', fw.data.thisWeek], ['Tuần sau', fw.data.nextWeek]] : [];
  return (
    <Card icon="🐾" title="Đua pet & Kitchen faction" subtitle="Lịch xoay vòng 12 tuần của wiki, đổi thứ Hai 07:00 giờ VN · Pet cần 3 món ăn + 1 búp bê, góp đủ mỗi thứ 1 lần để giữ streak">
      <ErrorNote error={fw.error} onRetry={fw.reload} />
      {!fw.data ? <EmptyState icon="⏳" title="Đang tải..." /> : (
        <div className="grid divide-y divide-line-soft lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {weeks.map(([label, w]) => (
            <div key={w.monday} className="border-line-soft">
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <span className="text-sm font-semibold text-fg">{label} <span className="font-normal text-fg-dim">· từ {fmtWeekDay(w.monday)} · vòng tuần {w.week}/12</span></span>
                {w.keyWeek && <span className="rounded-full bg-sun-400/15 px-2 py-0.5 text-[11px] font-semibold text-sun-300">Tuần nhận chìa khoá</span>}
              </div>
              <div className="divide-y divide-line-soft">
                {w.factions.map(f => (
                  <div key={f.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[110px_1fr]">
                    <div className="text-sm font-medium text-fg-muted">{f.label}</div>
                    <div className="space-y-1.5">
                      <div className="flex gap-2"><span className="w-12 shrink-0 pt-0.5 text-[11px] text-fg-dim">Pet</span><Chips items={f.pet} tone="bg-sell/10 text-fg" /></div>
                      <div className="flex gap-2"><span className="w-12 shrink-0 pt-0.5 text-[11px] text-fg-dim">Kitchen</span><Chips items={f.kitchen} tone="bg-ink-800 text-fg-muted" /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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
      <FactionWeekCard flipKey={flipKey} refreshKey={refreshKey} />
      <Card icon="🗓️" title="Lịch mùa 4 tuần tới" subtitle={chapter ? `${chapter.name || 'Chapter mới (chưa khai báo tên trong src-backend/domain/chapters.cjs)'} · tuần ${chapter.week ?? '–'}` : null}>
        <ErrorNote error={calendar.error} onRetry={calendar.reload} />
        {!cal ? <EmptyState icon="⏳" title="Đang tải..." /> : (
          <div className="grid gap-px bg-line-soft md:grid-cols-2 xl:grid-cols-4">
            {cal.upcoming.map((s, i) => (
              <div key={s.startedAt} className="space-y-3 bg-ink-900 px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: SEASON_META[s.season].color }}>{SEASON_META[s.season].icon} {SEASON_META[s.season].label}</span>
                  <span className="text-[11px] text-fg-dim">{i === 0 ? 'Tuần này' : new Date(s.startedAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-fg-dim">Lava Pit (Obsidian)</div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(s.lavaPit).map(([item, qty]) => (
                      <span key={item} className="inline-flex items-center gap-1 rounded-full bg-sun-400/10 py-0.5 pl-0.5 pr-2 text-[11px] text-sun-300"><ItemIcon item={item} size={16} />{item}<span className="num opacity-70">×{qty}</span></span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 text-[11px] font-medium text-fg-dim">Trồng được</div>
                  <div className="flex flex-wrap gap-1">
                    {s.crops.map(c => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-ink-800 py-0.5 pl-0.5 pr-2 text-[11px] text-fg-muted"><ItemIcon item={c} size={16} />{c}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card icon="🗒️" title="Yêu cầu theo chapter" subtitle="Đua pet, nhiệm vụ tuần, chế bánh... Đầu và cuối mỗi chapter yêu cầu thường lặp lại, lưu lại để chapter sau tra cứu.">
        <ErrorNote error={demand.error} onRetry={demand.reload} />
        {isOwner ? <DemandForm flipKey={flipKey} chapter={chapter} onSaved={demand.reload} /> : (
          <div className="border-b border-line-soft px-5 py-3 text-xs text-fg-dim">Chỉ chủ app (mã chủ) được thêm/xoá yêu cầu, bạn xem được danh sách bên dưới.</div>
        )}
        {!demand.data?.length ? (
          <EmptyState icon="🗒️" title="Chưa lưu yêu cầu nào">Thêm yêu cầu của tuần này ở form phía trên để chapter sau dùng lại.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-[11px] font-medium text-fg-dim">
                <tr>
                  <th className="border-b border-line-soft px-3 py-2.5 text-left">Nguồn</th>
                  <th className="border-b border-line-soft px-3 py-2.5 text-left">Chapter</th>
                  <th className="border-b border-line-soft px-3 py-2.5 text-right">Tuần</th>
                  <th className="border-b border-line-soft px-3 py-2.5 text-left">Mùa</th>
                  <th className="border-b border-line-soft px-3 py-2.5 text-left">Tài nguyên</th>
                  <th className="border-b border-line-soft px-3 py-2.5 text-left">Ghi chú</th>
                  <th className="border-b border-line-soft px-3 py-2.5 text-center">Vào điểm mua</th>
                  {isOwner && <th className="border-b border-line-soft px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {demand.data.map(d => (
                  <tr key={d.id}>
                    <td className="px-3 py-2.5 text-fg">{sourceLabel(d.source)}</td>
                    <td className="px-3 py-2 text-fg-muted">{d.chapter || '–'}</td>
                    <td className="num px-3 py-2 text-right text-fg-muted">{d.chapterWeek ?? '–'}</td>
                    <td className="px-3 py-2 text-fg-muted">{d.season ? SEASON_META[d.season]?.label : '–'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(d.items || {}).map(([item, qty]) => <span key={item} className="inline-flex items-center gap-1 rounded-full bg-ink-800 py-0.5 pl-0.5 pr-2 text-[11px] text-fg"><ItemIcon item={item} size={16} />{item}<span className="num text-fg-dim">×{qty}</span></span>)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-fg-dim">{d.note || ''}</td>
                    <td className="px-3 py-2 text-center">{d.useInScore ? <span className="text-buy">✓</span> : ''}</td>
                    {isOwner && <td className="px-3 py-2 text-right"><button type="button" onClick={() => remove(d.id)} className="text-xs text-fg-dim hover:text-loss">Xoá</button></td>}
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
