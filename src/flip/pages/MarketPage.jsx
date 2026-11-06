import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import ItemDetail from './ItemDetail';
import { Card, Chip, DecisionBadge, Delta, EmptyState, ErrorNote, ItemIcon, Segmented, SeasonTags } from '../components/ui';
import { CONFIDENCE_LABEL, DECISION_META, SEASON_META, fmtAgo, fmtCompact, fmtPct, fmtPrice } from '../lib/format';

const RANGES = ['1D', '3D', '7D', '30D', '90D'];
const RANGE_LABEL = { '1D': '24 giờ', '3D': '3 ngày', '7D': '7 ngày', '30D': '30 ngày', '90D': '90 ngày' };

/** Danh sách xếp hạng trong 3 thẻ tổng quan */
function RankList({ rows, render, onPick, empty }) {
  if (!rows.length) return <EmptyState icon="🗂️">{empty}</EmptyState>;
  return (
    <ol className="max-h-[300px] overflow-y-auto divide-y divide-slate-800">
      {rows.map((r, i) => (
        <li key={r.item}>
          <button type="button" onClick={() => onPick(r.item)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-800/60">
            <span className="w-6 text-xs text-slate-500">#{i + 1}</span>
            <ItemIcon item={r.item} />
            <span className="flex-1 truncate text-sm font-semibold text-slate-100">{r.item}</span>
            {render(r)}
          </button>
        </li>
      ))}
    </ol>
  );
}

const ACTION_META = {
  sell_now: { label: 'Bán ngay', className: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40' },
  hold: { label: 'Giữ, treo bán', className: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
  unknown: { label: 'Chưa rõ', className: 'bg-slate-500/10 text-slate-400 border-slate-500/30' }
};
const fmtDay = d => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('vi-VN') : '–');

/** Lô chưa bán trong Sổ Flip, ghép với đề xuất vòng mùa: bán ngay hay treo bán giá nào */
function HoldingsCard({ data, error, loading, onRetry, onPick }) {
  const rows = data?.rows || [];
  return (
    <Card title="Hàng đang giữ (từ Sổ Flip)" subtitle="Chỉ các món đang mở phiên trong Sổ Flip · giá mua TB lấy theo phiên, giống Sổ Flip · lãi đã trừ thuế bán">
      <ErrorNote error={error} onRetry={onRetry} />
      {!data && loading ? <EmptyState icon="⏳" title="Đang tải..." /> : !rows.length ? (
        <EmptyState icon="📦" title="Không có lô nào đang giữ">Mua hàng xong, Sổ Flip ghi lô mới thì sẽ hiện ở đây.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Tài nguyên</th>
                <th className="px-3 py-2 text-left">Nên làm</th>
                <th className="px-3 py-2 text-right">Số lượng</th>
                <th className="px-3 py-2 text-right">Giá mua TB (phiên)</th>
                <th className="px-3 py-2 text-right">Giá hiện tại</th>
                <th className="px-3 py-2 text-right">Lãi nếu bán giờ</th>
                <th className="px-3 py-2 text-right">Treo bán</th>
                <th className="px-3 py-2 text-right">Lãi ở giá treo</th>
                <th className="px-3 py-2 text-right">Đỉnh dự kiến</th>
                <th className="px-3 py-2 text-right">Đã giữ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(r => (
                <tr key={`${r.farmId}|${r.item}`} onClick={() => onPick(r.item)} className="cursor-pointer hover:bg-slate-800/50" title={r.note}>
                  <td className="px-3 py-2"><span className="flex items-center gap-2"><ItemIcon item={r.item} /><span className="font-semibold text-slate-100">{r.item}</span></span></td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold ${ACTION_META[r.action].className}`}>{ACTION_META[r.action].label}</span>
                    <div className="mt-0.5 max-w-[320px] text-[11px] text-slate-400">{r.note}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-200">{fmtCompact(r.qty)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-300">{fmtPrice(r.avgCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-200">{fmtPrice(r.price)}</td>
                  <td className="px-3 py-2 text-right"><Delta value={r.netNow} /></td>
                  <td className="px-3 py-2 text-right tabular-nums text-orange-300">{r.action === 'sell_now' ? '–' : fmtPrice(r.target)}</td>
                  <td className="px-3 py-2 text-right">{r.action === 'sell_now' ? '–' : <Delta value={r.netAtTarget} />}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">{r.action === 'sell_now' ? '–' : fmtDay(r.sellBy)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-400">{r.heldDays == null ? '–' : `${r.heldDays.toFixed(0)} ngày`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const RECO_STATUS = {
  pending: { label: 'Đang chờ khớp', cls: 'text-amber-300' },
  expired: { label: 'Không khớp', cls: 'text-slate-500' },
  holding: { label: 'Đã khớp, chờ bán', cls: 'text-sky-300' },
  done: { label: 'Xong', cls: 'text-slate-200' }
};

/** Đề xuất Mua đã đưa ra và kết quả thật, chấm bằng giá sàn 15 phút đã lưu */
function RecoCard({ data, error, onRetry }) {
  const sm = data?.summary;
  const list = data?.list || [];
  return (
    <Card title="Theo dõi đề xuất thật" subtitle="Mỗi món báo Mua được ghi lại 1 lần/ngày, rồi chấm bằng giá sàn 15 phút: offer có khớp không, bán được ở giá mục tiêu không">
      <ErrorNote error={error} onRetry={onRetry} />
      {!sm || !sm.total ? <EmptyState icon="📝" title="Chưa có đề xuất nào được ghi">Server ghi lại 15 phút/lần, từ lúc chạy bản này.</EmptyState> : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-slate-800 px-4 py-2.5 text-xs text-slate-300">
            <span>{sm.total} đề xuất · {sm.pending} đang chờ</span>
            <span>Tỉ lệ khớp offer: <b className="text-white">{sm.fillRate == null ? '–' : `${Math.round(sm.fillRate * 100)}%`}</b></span>
            <span>Đang giữ: {sm.holding}</span>
            <span>Xong: {sm.done}{sm.done ? `, thắng ${Math.round(sm.winRate * 100)}%, lãi TB ${fmtPct(sm.avgReturn)}` : ''}</span>
            <span>Mày đã mua theo: {sm.userBought}</span>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[760px] text-xs tabular-nums">
              <thead className="sticky top-0 bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
                <tr><th className="px-3 py-2 text-left">Ngày</th><th className="px-3 py-2 text-left">Món</th><th className="px-3 py-2 text-right">Offer</th><th className="px-3 py-2 text-right">Tới</th><th className="px-3 py-2 text-right">Bán</th><th className="px-3 py-2 text-left">Trạng thái</th><th className="px-3 py-2 text-right">Lãi</th><th className="px-3 py-2 text-right">Mày mua</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {list.map(r => {
                  const st = RECO_STATUS[r.eval?.status || 'pending'];
                  const ret = r.eval?.status === 'done' ? r.eval.ret : r.eval?.markRet;
                  return (
                    <tr key={`${r.date}|${r.item}`}>
                      <td className="px-3 py-1.5 text-slate-400">{fmtDay(r.date)}</td>
                      <td className="px-3 py-1.5 font-semibold text-slate-100">{r.item}</td>
                      <td className="px-3 py-1.5 text-right text-emerald-300">{fmtPrice(r.buyPrice)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{fmtDay(r.buyBy)}</td>
                      <td className="px-3 py-1.5 text-right text-orange-300">{fmtPrice(r.sellTarget)}</td>
                      <td className={`px-3 py-1.5 ${st.cls}`}>{st.label}{r.eval?.reason === 'timeout' ? ' (hết hạn bán)' : ''}</td>
                      <td className="px-3 py-1.5 text-right">{ret == null ? '–' : <Delta value={ret} />}</td>
                      <td className="px-3 py-1.5 text-right text-slate-300">{r.userBuys?.length ? `${fmtCompact(r.userBuys.reduce((a, b) => a + b.qty, 0))}` : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

const COLUMNS = [
  { key: 'item', label: 'Tài nguyên', align: 'left' },
  { key: 'decision', label: 'Đề xuất', align: 'left' },
  { key: 'price', label: 'Giá hiện tại' },
  { key: 'buyPrice', label: 'Giá mua (offer)' },
  { key: 'buyBy', label: 'Offer tới' },
  { key: 'sellTarget', label: 'Giá bán mục tiêu' },
  { key: 'sellBy', label: 'Bán chậm nhất' },
  { key: 'netMargin', label: 'Lãi ròng' },
  { key: 'cycle', label: 'Vòng mùa' },
  { key: 'trend', label: 'Xu hướng' },
  { key: 'avgTrades', label: 'Lệnh/ngày' },
  { key: 'supplyChange', label: 'Supply 7N' },
  { key: 'confidence', label: 'Tin cậy' }
];
const DECISION_ORDER = { buy: 0, sell: 1, wait: 2, avoid: 3, none: 4 };
const CONF_ORDER = { high: 0, medium: 1, low: 2 };

export default function MarketPage({ flipKey, refreshKey }) {
  const [range, setRange] = useState('7D');
  const [category, setCategory] = useState('all');
  const [season, setSeason] = useState('all');
  const [decision, setDecision] = useState('all');
  // Mặc định chỉ hiện danh sách theo dõi (món có lịch sử vòng mùa tốt + món đang báo Mua)
  const [watchOnly, setWatchOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'decision', dir: 1 });
  const [moverDir, setMoverDir] = useState('up');
  const [picked, setPicked] = useState(null);

  const calendar = useApi(() => api.calendar(flipKey), [flipKey, refreshKey]);
  const overview = useApi(() => api.overview(flipKey, range), [flipKey, range, refreshKey]);
  const signals = useApi(() => api.signals(flipKey), [flipKey, refreshKey]);
  const holdings = useApi(() => api.holdings(flipKey), [flipKey, refreshKey]);
  const recos = useApi(() => api.recos(flipKey), [flipKey, refreshKey]);

  const cal = calendar.data;
  const items = overview.data?.items || [];

  const matches = r => (category === 'all' || r.category === category)
    && (season === 'all' || (r.seasons || []).includes(season))
    && (!query || r.item.toLowerCase().includes(query.trim().toLowerCase()));

  const filtered = items.filter(matches);
  const byVolume = [...filtered].filter(r => r.volume > 0).sort((a, b) => b.volume - a.volume);
  const movers = [...filtered].filter(r => r.priceChange != null)
    .sort((a, b) => (moverDir === 'up' ? b.priceChange - a.priceChange : a.priceChange - b.priceChange));
  const supplyMovers = [...filtered].filter(r => r.supplyChange != null).sort((a, b) => Math.abs(b.supplyChange) - Math.abs(a.supplyChange));
  const totalVolume = byVolume.reduce((a, r) => a + r.volume, 0);

  const rows = useMemo(() => {
    const list = (signals.data?.signals || []).filter(s => matches(s) && (!watchOnly || s.watch !== false) && (decision === 'all' || s.decision === decision));
    const val = (s, key) => {
      if (key === 'decision') return DECISION_ORDER[s.decision] * 1000 + (s.rank ?? 0) * 100 - (s.score ?? 0);
      if (key === 'sellBy' || key === 'buyBy') return s[key] || '';
      if (key === 'cycle') return s.cycle ? s.cycle.gain * s.cycle.consistency : -Infinity;
      if (key === 'confidence') return CONF_ORDER[s.confidence];
      if (key === 'item' || key === 'bestSeason') return s[key] || '';
      if (key === 'trend') return s.trend?.slope7 ?? -Infinity;
      return s[key] ?? -Infinity;
    };
    return list.sort((a, b) => {
      const va = val(a, sort.key);
      const vb = val(b, sort.key);
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals.data, category, season, decision, query, sort, watchOnly]);

  const categories = cal?.categories || [];
  const countBy = id => items.filter(r => r.category === id).length;
  const decisionCount = id => (signals.data?.signals || []).filter(s => matches(s) && (!watchOnly || s.watch !== false) && s.decision === id).length;
  const watchCount = (signals.data?.signals || []).filter(s => s.watch !== false).length;
  const allCount = signals.data?.signals?.length || 0;
  const seasonTag = s => (cal?.current?.season === s ? 'BÂY GIỜ' : cal?.upcoming?.[1]?.season === s ? 'TIẾP THEO' : null);
  const coverage = overview.data?.coverage;

  return (
    <div className="space-y-5">
      {/* Lịch mùa + Lava Pit */}
      {cal && (
        <div className="grid gap-3 md:grid-cols-4">
          {cal.upcoming.map((s, i) => (
            <div key={s.startedAt} className={`rounded-xl border p-3 ${i === 0 ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-700/60 bg-[#111827]/70'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: SEASON_META[s.season].color }}>{SEASON_META[s.season].icon} {SEASON_META[s.season].label}</span>
                <span className="text-[11px] text-slate-400">{i === 0 ? 'Tuần này' : `Từ ${new Date(s.startedAt).toLocaleDateString('vi-VN')}`}</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">Lava Pit cần:</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(s.lavaPit).map(([item, qty]) => (
                  <button key={item} type="button" onClick={() => setPicked(item)} className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700">
                    <ItemIcon item={item} size={16} />{item} ×{qty}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Card
        title={`Tài nguyên (${RANGE_LABEL[range]} gần nhất)`}
        subtitle={overview.data
          ? `Giá bằng SFL · cập nhật ${fmtAgo(overview.data.updatedAt)}${coverage ? ` · có ${coverage.dailyDays} ngày giá, ${coverage.supplyDays} ngày supply` : ''}`
          : 'Đang tải...'}
        right={<Segmented options={RANGES} value={range} onChange={setRange} size="sm" />}
      >
        <div className="space-y-3 border-b border-slate-700/50 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <Chip active={category === 'all'} onClick={() => setCategory('all')} count={items.length}>Tất cả</Chip>
            {categories.map(c => countBy(c.id) > 0 && (
              <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} count={countBy(c.id)}>{c.label}</Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Trồng được trong</span>
            <Chip active={season === 'all'} onClick={() => setSeason('all')}>Tất cả các mùa</Chip>
            {Object.entries(SEASON_META).map(([id, m]) => (
              <Chip key={id} active={season === id} onClick={() => setSeason(id)} tag={seasonTag(id)}>{m.icon} {m.label}</Chip>
            ))}
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tài nguyên..."
              className="ml-auto w-full sm:w-56 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500" />
          </div>
        </div>

        <ErrorNote error={overview.error} onRetry={overview.reload} />
        {!overview.data && overview.loading ? (
          <EmptyState icon="⏳" title="Đang tải dữ liệu chợ..." />
        ) : !items.length ? (
          <EmptyState icon="📭" title="Chưa có dữ liệu chợ trong hệ thống">
            Server sẽ tự chụp chợ 15 phút/lần và lấp lịch sử theo ngày ngay khi khởi động (cần SFL_API_KEY trong .env).
            Bấm Đồng bộ sau vài phút để xem.
          </EmptyState>
        ) : (
          <div className="grid gap-px bg-slate-800/60 lg:grid-cols-3">
            <div className="bg-[#111827]">
              <div className="px-4 pt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Hoạt động giao dịch</div>
              <div className="px-4 pb-2">
                <div className="text-2xl font-extrabold text-yellow-300 tabular-nums">{fmtCompact(totalVolume)} <span className="text-sm text-slate-400">SFL</span></div>
                <div className="text-[11px] text-slate-400">Tổng giá trị khớp · {RANGE_LABEL[range]} {overview.data?.totals?.volumeChange != null && category === 'all' && season === 'all' && !query && <Delta value={overview.data.totals.volumeChange} />}</div>
              </div>
              <RankList rows={byVolume} onPick={setPicked} empty="Không có giao dịch trong khoảng này"
                render={r => <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[11px] font-bold text-yellow-300 tabular-nums">{totalVolume ? ((r.volume / totalVolume) * 100).toFixed(1) : 0}% · {fmtCompact(r.volume)}</span>} />
            </div>
            <div className="bg-[#111827]">
              <div className="flex items-center justify-between px-4 pt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Biến động giá</span>
                <Segmented size="sm" options={[{ id: 'up', label: '▲ Tăng' }, { id: 'down', label: '▼ Giảm' }]} value={moverDir} onChange={setMoverDir} />
              </div>
              <div className="px-4 pb-2 text-[11px] text-slate-400">
                {movers.filter(r => r.priceChange > 0.01).length} tăng · {movers.filter(r => Math.abs(r.priceChange) <= 0.01).length} đứng · {movers.filter(r => r.priceChange < -0.01).length} giảm
              </div>
              <RankList rows={movers} onPick={setPicked} empty="Cần ít nhất 2 ngày giá để tính biến động" render={r => <Delta value={r.priceChange} />} />
            </div>
            <div className="bg-[#111827]">
              <div className="px-4 pt-3 text-xs font-bold uppercase tracking-wider text-slate-400">Cung ứng & người giữ</div>
              <div className="px-4 pb-2 text-[11px] text-slate-400">Đổi active supply trong {RANGE_LABEL[range]}</div>
              <RankList rows={supplyMovers} onPick={setPicked}
                empty="Chưa đủ dữ liệu supply. Server đếm từ nightly dump mỗi ngày lúc 22:40 UTC, cần ít nhất 2 ngày."
                render={r => <span className="flex items-center gap-2"><span className="text-[11px] text-slate-500">{fmtCompact(r.holders)} người</span><Delta value={r.supplyChange} digits={2} /></span>} />
            </div>
          </div>
        )}
      </Card>

      <HoldingsCard data={holdings.data} error={holdings.error} loading={holdings.loading} onRetry={holdings.reload} onPick={setPicked} />

      <Card
        title="Điểm mua"
        subtitle={signals.data ? `Thuế bán dùng để tính: ${fmtPct(signals.data.taxRate).replace('+', '')}${signals.data.taxFromFarm ? ' (theo farm của bạn)' : ' (mặc định, đồng bộ farm để lấy thuế thật)'} · bấm 1 dòng để xem biểu đồ` : 'Đang tính...'}
        right={
          <div className="flex flex-wrap gap-2">
            <Chip active={watchOnly} onClick={() => setWatchOnly(true)} count={watchCount}>Đang theo dõi</Chip>
            <Chip active={!watchOnly} onClick={() => setWatchOnly(false)} count={allCount}>Mọi món</Chip>
            <span className="mx-1 w-px self-stretch bg-slate-700" />
            <Chip active={decision === 'all'} onClick={() => setDecision('all')}>Tất cả</Chip>
            {['buy', 'sell', 'wait', 'avoid', 'none'].map(d => (
              <Chip key={d} active={decision === d} onClick={() => setDecision(d)} count={decisionCount(d)}>{DECISION_META[d].label}</Chip>
            ))}
          </div>
        }
      >
        <ErrorNote error={signals.error} onRetry={signals.reload} />
        {signals.data?.portfolio?.trades > 0 && (() => {
          const p = signals.data.portfolio;
          return (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-slate-800 bg-emerald-500/5 px-4 py-2.5 text-xs text-slate-300">
              <span className="font-bold text-emerald-300">Chỉ báo Mua top {signals.data.topN} lệnh tốt nhất, {signals.data.buyMode === 'now' ? 'mua ở giá sàn' : 'canh đáy bằng offer'}, tối đa 28 ngày</span>
              <span>Backtest {p.from} → {p.to}: {p.trades} lệnh{p.expiredOrders ? ` (+${p.expiredOrders} offer không khớp)` : ''}, thắng {Math.round(p.winRate * 100)}%, lãi TB <b className={p.avgReturn >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{fmtPct(p.avgReturn)}</b>/lệnh, giữ TB {p.avgHoldDays.toFixed(0)} ngày, lệnh tệ nhất {fmtPct(p.worst)}</span>
              {p.secondHalf?.trades > 0 && <span className="text-slate-500">Nửa sau (từ {p.secondHalf.from}): {p.secondHalf.trades} lệnh, thắng {Math.round(p.secondHalf.winRate * 100)}%, {fmtPct(p.secondHalf.avgReturn)}/lệnh</span>}
            </div>
          );
        })()}
        {!signals.data && signals.loading ? (
          <EmptyState icon="⏳" title="Đang tính điểm mua..." />
        ) : !rows.length ? (
          <EmptyState icon="🔎" title="Không có tài nguyên nào khớp bộ lọc">
            {signals.data?.signals?.length ? 'Thử bỏ bớt bộ lọc.' : 'Chưa có dữ liệu giá theo ngày. Đợi server lấp lịch sử xong (vài phút).'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-slate-900/70 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  {COLUMNS.map(c => (
                    <th key={c.key} onClick={() => setSort(p => ({ key: c.key, dir: p.key === c.key ? -p.dir : 1 }))}
                      className={`cursor-pointer select-none px-3 py-2.5 font-semibold ${c.align === 'left' ? 'text-left' : 'text-right'} ${sort.key === c.key ? 'text-blue-300' : ''}`}>
                      {c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(s => (
                  <tr key={s.item} onClick={() => setPicked(s.item)} className="cursor-pointer hover:bg-slate-800/50">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        {s.rank && <span className="rounded bg-emerald-500/20 px-1.5 text-[10px] font-extrabold text-emerald-300">#{s.rank}</span>}
                        <ItemIcon item={s.item} />
                        <span className="font-semibold text-slate-100">{s.item}</span>
                        <SeasonTags seasons={s.seasons} />
                        {s.demand?.length > 0 && <span title={s.demand.map(d => `${d.label}: ${d.qty}`).join(', ')} className="rounded bg-orange-500/15 px-1 text-[10px] font-bold text-orange-300">CẦN</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2"><DecisionBadge decision={s.decision} /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-200">{fmtPrice(s.price)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${s.decision === 'buy' ? 'text-emerald-300' : 'text-emerald-300/50'}`}>
                      {s.decision === 'none' ? '–' : fmtPrice(s.buyPrice)}
                      {s.hardToFill && <span title="Thấp hơn giá thấp nhất 28 ngày qua: gần như không khớp" className="ml-1 rounded bg-slate-700/60 px-1 text-[10px] font-bold text-slate-300">khó khớp</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">{s.buyBy ? new Date(`${s.buyBy}T00:00:00Z`).toLocaleDateString('vi-VN') : '–'}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${s.decision === 'buy' ? 'text-orange-300' : 'text-orange-300/50'}`}>{s.decision === 'none' ? '–' : fmtPrice(s.sellTarget)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-300">{s.sellBy ? new Date(`${s.sellBy}T00:00:00Z`).toLocaleDateString('vi-VN') : '–'}</td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${s.netMargin >= 0.1 ? 'text-emerald-300' : s.netMargin >= 0 ? 'text-slate-200' : 'text-rose-300'}`}>{s.netMargin == null ? '–' : fmtPct(s.netMargin)}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {!s.cycle ? <span className="text-slate-500">–</span> : (
                        <span className="text-slate-300" title={`Lãi kỳ vọng sau thuế ${fmtPct(s.cycle.gain)}, đúng hướng ${Math.round(s.cycle.consistency * 100)}% số vòng mùa trước (${s.cycle.cycles} vòng)`}>
                          {fmtPct(s.cycle.gain)} · <span className={s.cycle.consistency >= 0.7 ? 'text-emerald-300' : 'text-slate-500'}>{Math.round(s.cycle.consistency * 100)}%</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      {!s.trend || s.trend.state === 'unknown' ? '–' : (
                        <span className={s.trend.state === 'down' ? 'text-rose-300' : s.trend.state === 'up' ? 'text-emerald-300' : 'text-slate-300'}
                          title={`TB 7 ngày đổi ${fmtPct(s.trend.slope7)} so với tuần trước`}>
                          {s.trend.state === 'down' ? '▼ Giảm' : s.trend.state === 'up' ? '▲ Tăng' : '→ Ngang'}
                        </span>
                      )}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${s.avgTrades < 20 ? 'text-rose-300' : 'text-slate-300'}`}>{s.avgTrades == null ? '–' : Math.round(s.avgTrades)}</td>
                    <td className="px-3 py-2 text-right"><Delta value={s.supplyChange} /></td>
                    <td className="px-3 py-2 text-right text-xs text-slate-400">{CONFIDENCE_LABEL[s.confidence]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-slate-800 px-4 py-2.5 text-[11px] leading-relaxed text-slate-500">
          Đề xuất dựa vào vòng mùa 4 tuần: mỗi món có ngày trong vòng thường rẻ và ngày thường đắt (vd Corn đắt nhất mùa đông, Onion đắt nhất đầu mùa đông vì Lava Pit).
          Giá mua = giá đáy dự kiến trong 28 ngày tới (+5% cho dễ khớp), nhưng không cao hơn mức để bán ở giá mục tiêu trừ thuế còn lãi ≥ 15%: đặt offer tới ngày "Offer tới", không khớp thì huỷ; giá sàn đã thấp hơn thì mua ngay. Giá bán = giá đỉnh dự kiến sau đáy.
          Dòng không phải Mua thì giá in mờ (chỉ để tham khảo). "khó khớp" = giá mua thấp hơn mọi giá 28 ngày qua.
          Mua = chênh đáy–đỉnh sau thuế ≥ 15%, đúng hướng ở ≥ 70% số vòng trước, đủ thanh khoản; chỉ giữ top {signals.data?.topN ?? 3} món tốt nhất. "Đang theo dõi" = món mà mua ở đáy, bán ở đỉnh của vòng mùa (tính lùi từng vòng, không nhìn trước) ra lãi TB ≥ 10% sau thuế, thắng ≥ 50%, đủ ≥ 4 vòng, cộng món đang báo Mua (món đang giữ xem ở bảng Hàng đang giữ); món giá đi đều hoặc lịch sử lỗ bị ẩn (máy vẫn quét để không bỏ lỡ).
          Bán = trong 7 ngày tới giá thường giảm ≥ 10%, đang giữ thì nên bán. Mua chỉ báo ở khúc đáy: trước ngày đỉnh còn ngày rẻ hơn ≥ 2% thì Chờ. Chờ = chưa đủ chắc. Vòng mùa = chênh đáy–đỉnh sau thuế · tỉ lệ vòng đúng hướng.
          Supply 3 tháng chỉ được dùng khi đã thu đủ ~60 ngày.
        </p>
      </Card>

      <RecoCard data={recos.data} error={recos.error} onRetry={recos.reload} />

      {picked && <ItemDetail item={picked} flipKey={flipKey} refreshKey={refreshKey} onClose={() => setPicked(null)} />}
    </div>
  );
}
