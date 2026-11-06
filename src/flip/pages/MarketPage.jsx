import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import ItemDetail from './ItemDetail';
import { Card, Chip, DecisionBadge, Delta, EmptyState, ErrorNote, Explain, ItemIcon, Segmented, SeasonTags, Stat } from '../components/ui';
import { CONFIDENCE_LABEL, DECISION_META, SEASON_META, fmtAgo, fmtCompact, fmtPct, fmtPrice } from '../lib/format';

const RANGES = ['1D', '3D', '7D', '30D', '90D'];
const RANGE_LABEL = { '1D': '24 giờ', '3D': '3 ngày', '7D': '7 ngày', '30D': '30 ngày', '90D': '90 ngày' };
const fmtDay = d => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '–');
const TH = 'px-3 py-2.5 text-[11px] font-medium text-fg-dim whitespace-nowrap';

/* ---------- Hôm nay: món nên mua ---------- */

/** Thẻ 1 lệnh Mua: số quan trọng nhất (lãi ròng, giá mua/bán, hạn) to và rõ */
function BuyCard({ s, buyMode, onPick }) {
  const faction = s.cycleBuy?.source === 'faction';
  return (
    <button type="button" onClick={() => onPick(s.item)}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-ink-850 p-4 text-left transition-colors hover:border-buy/40 hover:bg-ink-800">
      <div className="flex items-center gap-3">
        <ItemIcon item={s.item} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-base font-semibold text-fg">{s.item}</span>
            <SeasonTags seasons={s.seasons} />
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-dim">
            <span className="rounded-full bg-buy/12 px-2 py-0.5 font-semibold text-buy">#{s.rank} Mua</span>
            <span>{faction ? 'theo faction' : 'theo vòng mùa'}</span>
            {s.confidence && <span>· tin cậy {CONFIDENCE_LABEL[s.confidence]?.toLowerCase()}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="num text-2xl font-bold text-buy">{fmtPct(s.netMargin)}</div>
          <div className="text-[11px] text-fg-dim">lãi ròng sau thuế</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-ink-900 px-3 py-2.5">
        <Stat label={buyMode === 'now' ? 'Mua ≤' : 'Đặt offer'} value={fmtPrice(s.buyPrice)} tone="buy" />
        <Stat label="Treo bán ~" value={fmtPrice(s.sellTarget)} tone="sell" />
        <Stat label="Bán chậm nhất" value={fmtDay(s.sellBy)} hint={buyMode !== 'now' && s.buyBy ? `offer tới ${fmtDay(s.buyBy)}` : null} />
      </div>
    </button>
  );
}

function TodayBuys({ signals, loading, onPick }) {
  const buys = (signals?.signals || []).filter(s => s.decision === 'buy').sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const p = signals?.portfolio;
  return (
    <Card
      icon="🎯"
      title="Nên mua hôm nay"
      subtitle={signals ? `Tối đa ${signals.topN} món cùng lúc · ${signals.buyMode === 'now' ? 'mua ở giá sàn' : 'canh đáy bằng offer'} · thuế bán ${fmtPct(signals.taxRate).replace('+', '')}${signals.taxFromFarm ? '' : ' (mặc định)'}` : 'Đang tính...'}
    >
      <div className="p-4">
        {!signals && loading ? <EmptyState icon="⏳" title="Đang tính điểm mua..." /> : !buys.length ? (
          <EmptyState icon="🌙" title="Hôm nay chưa có món nào tới đáy">
            Các món trong danh sách theo dõi bên dưới đang ở trạng thái Chờ, cột Giá mua ghi giá dự kiến lúc rẻ hơn.
          </EmptyState>
        ) : (
          <div className={`grid gap-3 ${buys.length > 1 ? 'md:grid-cols-2' : ''}`}>
            {buys.map(s => <BuyCard key={s.item} s={s} buyMode={signals.buyMode} onPick={onPick} />)}
          </div>
        )}
      </div>
      {p?.trades > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line-soft px-5 py-3 text-xs text-fg-dim">
          <span>Backtest {fmtDay(p.from)}/{p.from?.slice(2, 4)} → {fmtDay(p.to)}/{p.to?.slice(2, 4)}</span>
          <span><b className="num text-fg">{p.trades}</b> lệnh</span>
          <span>thắng <b className="num text-fg">{Math.round(p.winRate * 100)}%</b></span>
          <span>lãi TB <b className={`num ${p.avgReturn >= 0 ? 'text-buy' : 'text-loss'}`}>{fmtPct(p.avgReturn)}</b>/lệnh</span>
          <span>giữ TB <b className="num text-fg">{p.avgHoldDays.toFixed(0)}</b> ngày</span>
          <span>tệ nhất <b className="num text-loss">{fmtPct(p.worst)}</b></span>
        </div>
      )}
    </Card>
  );
}

/** Lịch 4 tuần mùa tới, gọn trong 1 cột */
function SeasonStrip({ cal, onPick }) {
  if (!cal) return <Card icon="🗓️" title="Lịch mùa"><EmptyState icon="⏳" title="Đang tải..." /></Card>;
  return (
    <Card icon="🗓️" title="Lịch mùa" subtitle={cal.chapter ? `${cal.chapter.name} · tuần ${cal.chapter.week}` : 'Mỗi mùa 1 tuần, đổi thứ Hai 00:00 UTC'}>
      <ol className="grid divide-y divide-line-soft sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {cal.upcoming.map((s, i) => {
          const m = SEASON_META[s.season];
          return (
            <li key={s.startedAt} className={`border-line-soft px-5 py-3 ${i === 0 ? 'bg-ink-850' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: m.color }}>{m.icon} {m.label}</span>
                <span className="text-[11px] text-fg-dim">{i === 0 ? 'Tuần này' : `Từ ${new Date(s.startedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(s.lavaPit).map(([item, qty]) => (
                  <button key={item} type="button" onClick={() => onPick(item)} title={`Lava Pit ${m.label} cần ${qty} ${item}`}
                    className="inline-flex items-center gap-1 rounded-full bg-ink-800 py-0.5 pl-0.5 pr-2 text-[11px] text-fg-muted hover:bg-ink-700 hover:text-fg">
                    <ItemIcon item={item} size={16} />{item}<span className="num text-fg-dim">×{qty}</span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line-soft px-5 py-2.5 text-[11px] text-fg-dim">Chip là nguyên liệu Lava Pit của mùa đó · bấm để xem giá</div>
    </Card>
  );
}

/* ---------- Hàng đang giữ ---------- */

const ACTION_META = {
  sell_now: { label: 'Bán ngay', className: 'bg-sell/12 text-sell ring-1 ring-sell/30', dot: 'bg-sell' },
  hold: { label: 'Giữ, treo bán', className: 'bg-info/10 text-info ring-1 ring-info/25', dot: 'bg-info' },
  unknown: { label: 'Chưa rõ', className: 'bg-ink-800 text-fg-dim ring-1 ring-line', dot: 'bg-fg-dim' }
};

function HoldingsCard({ flipKey, data, error, loading, onRetry, onPick }) {
  const rows = data?.rows || [];
  const hidden = data?.hidden || [];
  const [busy, setBusy] = useState(null);
  const setIgnore = async (e, r, ignore) => {
    e.stopPropagation();
    if (ignore && !window.confirm(`Bỏ ${r.item} khỏi Hàng đang giữ? Sổ Flip vẫn tính bình thường, muốn hiện lại thì bấm tên món ở cuối thẻ.`)) return;
    setBusy(r.item);
    try {
      await api.ignoreHolding(flipKey, r.item, ignore, r.farmId);
      onRetry();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(null);
    }
  };
  const sellNow = rows.filter(r => r.action === 'sell_now').length;
  return (
    <Card icon="📦" title="Hàng đang giữ"
      subtitle="Các món đang mở phiên trong Sổ Flip · giá vốn = giá mua TB của phiên · lãi đã trừ thuế bán"
      right={rows.length > 0 && (
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sellNow ? 'bg-sell/12 text-sell' : 'bg-ink-800 text-fg-muted'}`}>
          {sellNow ? `${sellNow} món nên bán ngay` : `${rows.length} món, chưa tới lúc bán`}
        </span>
      )}>
      <ErrorNote error={error} onRetry={onRetry} />
      {!data && loading ? <EmptyState icon="⏳" title="Đang tải..." /> : !rows.length ? (
        <EmptyState icon="📭" title={hidden.length ? 'Các món đang giữ đều đã ẩn' : 'Không có lô nào đang giữ'}>Mua hàng xong, Sổ Flip ghi lô mới thì sẽ hiện ở đây.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="border-b border-line-soft">
              <tr>
                <th className={`${TH} pl-5 text-left`}>Tài nguyên</th>
                <th className={`${TH} text-left`}>Nên làm</th>
                <th className={`${TH} text-right`}>Số lượng</th>
                <th className={`${TH} text-right`}>Giá vốn</th>
                <th className={`${TH} text-right`}>Giá hiện tại</th>
                <th className={`${TH} text-right`}>Lãi nếu bán giờ</th>
                <th className={`${TH} text-right`}>Treo bán</th>
                <th className={`${TH} text-right`}>Lãi ở giá treo</th>
                <th className={`${TH} text-right`}>Hẹn bán</th>
                <th className={`${TH} text-right`}>Đã giữ</th>
                <th className={`${TH} pr-5`}><span className="sr-only">Ẩn</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map(r => {
                const a = ACTION_META[r.action];
                return (
                  <tr key={`${r.farmId}|${r.item}`} onClick={() => onPick(r.item)} className="cursor-pointer align-top hover:bg-ink-850">
                    <td className="py-3 pl-5 pr-3"><span className="flex items-center gap-2.5"><ItemIcon item={r.item} size={32} /><span className="font-semibold text-fg">{r.item}</span></span></td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${a.className}`}><span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />{a.label}</span>
                      <div className="mt-1 max-w-[340px] text-[11px] leading-snug text-fg-dim">{r.note}</div>
                    </td>
                    <td className="num px-3 py-3 text-right text-fg">{fmtCompact(r.qty)}</td>
                    <td className="num px-3 py-3 text-right text-fg-muted">{fmtPrice(r.avgCost)}</td>
                    <td className="num px-3 py-3 text-right text-fg">{fmtPrice(r.price)}</td>
                    <td className="px-3 py-3 text-right"><Delta value={r.netNow} /></td>
                    <td className="num px-3 py-3 text-right text-sell">{r.action === 'sell_now' ? '–' : fmtPrice(r.target)}</td>
                    <td className="px-3 py-3 text-right">{r.action === 'sell_now' ? <span className="text-fg-dim">–</span> : <Delta value={r.netAtTarget} />}</td>
                    <td className={`num px-3 py-3 text-right text-xs ${r.overdue ? 'text-loss' : 'text-fg-muted'}`}>{r.action === 'sell_now' && !r.overdue ? '–' : fmtDay(r.sellBy)}</td>
                    <td className="num px-3 py-3 text-right text-xs text-fg-dim">{r.heldDays == null ? '–' : `${r.heldDays.toFixed(0)} ngày`}</td>
                    <td className="py-2.5 pl-1 pr-4 text-right">
                      <button type="button" disabled={busy === r.item} onClick={e => setIgnore(e, r, true)}
                        title="Món mua để dùng, không bán: bỏ khỏi danh sách này (Sổ Flip vẫn tính)"
                        className="whitespace-nowrap rounded-lg border border-line px-2 py-1 text-[11px] text-fg-dim hover:border-loss/40 hover:text-loss disabled:opacity-50">
                        {busy === r.item ? '...' : 'Ẩn'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft px-5 py-2.5 text-[11px] text-fg-dim">
          <span>Đã ẩn (mua để dùng):</span>
          {hidden.map(h => (
            <button key={`${h.farmId}|${h.item}`} type="button" disabled={busy === h.item} onClick={e => setIgnore(e, h, false)} title="Bấm để hiện lại"
              className="inline-flex items-center gap-1 rounded-full bg-ink-800 py-0.5 pl-0.5 pr-2 text-fg-muted hover:bg-ink-700 hover:text-fg disabled:opacity-50">
              <ItemIcon item={h.item} size={16} />{h.item}<span className="text-fg-dim">↺</span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------- Danh sách theo dõi ---------- */

const COLUMNS = [
  { key: 'item', label: 'Tài nguyên', align: 'left' },
  { key: 'decision', label: 'Đề xuất', align: 'left' },
  { key: 'price', label: 'Giá hiện tại' },
  { key: 'buyPrice', label: 'Giá mua' },
  { key: 'sellTarget', label: 'Bán mục tiêu' },
  { key: 'netMargin', label: 'Lãi ròng' },
  { key: 'sellBy', label: 'Hạn' },
  { key: 'cycle', label: 'Vòng mùa' },
  { key: 'trend', label: 'Xu hướng' },
  { key: 'avgTrades', label: 'Lệnh/ngày' },
  { key: 'supplyChange', label: 'Supply 7N', optional: true },
  { key: 'confidence', label: 'Tin cậy' }
];
const DECISION_ORDER = { buy: 0, sell: 1, wait: 2, avoid: 3, none: 4 };
const CONF_ORDER = { high: 0, medium: 1, low: 2 };

function BuyPriceCell({ s, buyMode }) {
  if (s.decision === 'none') return <span className="text-fg-dim">–</span>;
  // Mua giá sàn mà đang Chờ: hiện giá dự kiến lúc rẻ hơn (không phải giá hôm nay), không có thì để trống
  if (s.decision === 'wait' && buyMode === 'now') {
    return s.cycle?.cheaperInDays
      ? <span className="text-buy/60" title={`Khoảng ${s.cycle.cheaperInDays} ngày nữa giá thường rẻ hơn ~${(s.cycle.cheaperPct * 100).toFixed(1)}%`}>~{fmtPrice(s.price * (1 - s.cycle.cheaperPct))}</span>
      : <span className="text-fg-dim">–</span>;
  }
  return (
    <span className={s.decision === 'buy' ? 'font-semibold text-buy' : 'text-buy/50'}>
      {fmtPrice(s.buyPrice)}
      {s.hardToFill && <span title="Thấp hơn giá thấp nhất 28 ngày qua: gần như không khớp" className="ml-1 rounded-full bg-ink-800 px-1.5 text-[10px] font-semibold text-fg-muted">khó khớp</span>}
    </span>
  );
}

function WatchTable({ signals, loading, error, onRetry, onPick }) {
  const [watchOnly, setWatchOnly] = useState(true);
  const [decision, setDecision] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'decision', dir: 1 });
  const all = signals?.signals || [];
  const base = all.filter(s => (!watchOnly || s.watch !== false) && (!query || s.item.toLowerCase().includes(query.trim().toLowerCase())));
  const hasSupply = all.some(s => s.supplyChange != null);
  const cols = COLUMNS.filter(c => !c.optional || hasSupply);

  const rows = useMemo(() => {
    const val = (s, key) => {
      if (key === 'decision') return DECISION_ORDER[s.decision] * 1000 + (s.rank ?? 0) * 100 - (s.score ?? 0);
      if (key === 'sellBy') return s.sellBy || s.buyBy || '';
      if (key === 'cycle') return s.cycle ? s.cycle.gain * s.cycle.consistency : -Infinity;
      if (key === 'confidence') return CONF_ORDER[s.confidence];
      if (key === 'item') return s.item;
      if (key === 'trend') return s.trend?.slope7 ?? -Infinity;
      return s[key] ?? -Infinity;
    };
    return base.filter(s => decision === 'all' || s.decision === decision).sort((a, b) => {
      const va = val(a, sort.key);
      const vb = val(b, sort.key);
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals, watchOnly, decision, query, sort]);

  const count = id => base.filter(s => s.decision === id).length;
  const watchCount = all.filter(s => s.watch !== false).length;

  return (
    <Card icon="👀" title="Danh sách theo dõi"
      subtitle={watchOnly ? 'Món có chu kỳ mùa đáng tiền + món đang báo Mua · bấm 1 dòng để xem biểu đồ' : 'Mọi tài nguyên trên chợ · bấm 1 dòng để xem biểu đồ'}
      right={<Segmented size="sm" value={watchOnly ? 'watch' : 'all'} onChange={v => setWatchOnly(v === 'watch')}
        options={[{ id: 'watch', label: `Đang theo dõi · ${watchCount}` }, { id: 'all', label: `Mọi món · ${all.length}` }]} />}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3">
        <Chip active={decision === 'all'} onClick={() => setDecision('all')} count={base.length}>Tất cả</Chip>
        {['buy', 'wait', 'sell', 'avoid', 'none'].map(d => count(d) > 0 && (
          <Chip key={d} active={decision === d} onClick={() => setDecision(d)} count={count(d)}>{DECISION_META[d].label}</Chip>
        ))}
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tài nguyên..."
          className="ml-auto w-full rounded-xl border border-line bg-ink-850 px-3 py-1.5 text-sm text-fg outline-none placeholder:text-fg-dim focus:border-sun-400/60 sm:w-56" />
      </div>
      <ErrorNote error={error} onRetry={onRetry} />
      {!signals && loading ? <EmptyState icon="⏳" title="Đang tính điểm mua..." /> : !rows.length ? (
        <EmptyState icon="🔎" title="Không có tài nguyên nào khớp bộ lọc">
          {all.length ? 'Thử bỏ bớt bộ lọc.' : 'Chưa có dữ liệu giá theo ngày. Đợi server lấp lịch sử xong (vài phút).'}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-line-soft">
              <tr>
                {cols.map((c, i) => (
                  <th key={c.key} onClick={() => setSort(p => ({ key: c.key, dir: p.key === c.key ? -p.dir : 1 }))}
                    className={`${TH} cursor-pointer select-none hover:text-fg ${c.align === 'left' ? 'text-left' : 'text-right'} ${i === 0 ? 'pl-5' : ''} ${i === cols.length - 1 ? 'pr-5' : ''} ${sort.key === c.key ? 'text-sun-300' : ''}`}>
                    {c.label}{sort.key === c.key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map(s => {
                const dim = s.decision !== 'buy';
                return (
                  <tr key={s.item} onClick={() => onPick(s.item)} className={`cursor-pointer hover:bg-ink-850 ${s.decision === 'buy' ? 'bg-buy/[0.04]' : ''}`}>
                    <td className="py-2.5 pl-5 pr-3">
                      <span className="flex items-center gap-2.5">
                        <ItemIcon item={s.item} />
                        <span className="font-medium text-fg">{s.item}</span>
                        <SeasonTags seasons={s.seasons} />
                        {s.demand?.length > 0 && <span title={s.demand.map(d => `${d.label}: ${d.qty}`).join(', ')} className="rounded-full bg-sun-400/12 px-1.5 text-[10px] font-semibold text-sun-300">Lava Pit</span>}
                        {s.faction?.nextWeek && <span title="Faction tuần sau xin món này" className="rounded-full bg-info/10 px-1.5 text-[10px] font-semibold text-info">Faction</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5"><DecisionBadge decision={s.decision} /></td>
                    <td className="num px-3 py-2.5 text-right text-fg">{fmtPrice(s.price)}</td>
                    <td className="num px-3 py-2.5 text-right"><BuyPriceCell s={s} buyMode={signals.buyMode} /></td>
                    <td className={`num px-3 py-2.5 text-right ${dim ? 'text-sell/50' : 'font-semibold text-sell'}`}>{s.decision === 'none' ? '–' : fmtPrice(s.sellTarget)}</td>
                    <td className={`num px-3 py-2.5 text-right font-semibold ${s.netMargin == null ? 'text-fg-dim' : s.netMargin >= 0.1 ? (dim ? 'text-buy/60' : 'text-buy') : s.netMargin >= 0 ? 'text-fg-muted' : 'text-loss'}`}>{s.netMargin == null ? '–' : fmtPct(s.netMargin)}</td>
                    <td className="num px-3 py-2.5 text-right text-xs text-fg-muted">
                      {s.decision === 'buy' && signals.buyMode !== 'now' && s.buyBy ? <div title="Offer giữ tới">mua ≤ {fmtDay(s.buyBy)}</div> : null}
                      {s.sellBy ? <div title="Bán chậm nhất">bán ≤ {fmtDay(s.sellBy)}</div> : (!s.buyBy && '–')}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {!s.cycle ? <span className="text-fg-dim">–</span> : (
                        <span className="num text-fg-muted" title={`Lãi kỳ vọng sau thuế ${fmtPct(s.cycle.gain)}, đúng hướng ${Math.round(s.cycle.consistency * 100)}% số vòng mùa trước (${s.cycle.cycles} vòng)`}>
                          {fmtPct(s.cycle.gain)} · <span className={s.cycle.consistency >= 0.7 ? 'text-buy' : 'text-fg-dim'}>{Math.round(s.cycle.consistency * 100)}%</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {!s.trend || s.trend.state === 'unknown' ? <span className="text-fg-dim">–</span> : (
                        <span className={s.trend.state === 'down' ? 'text-loss' : s.trend.state === 'up' ? 'text-buy' : 'text-fg-muted'}
                          title={`TB 7 ngày đổi ${fmtPct(s.trend.slope7)} so với tuần trước`}>
                          {s.trend.state === 'down' ? '↘ Giảm' : s.trend.state === 'up' ? '↗ Tăng' : '→ Ngang'}
                        </span>
                      )}
                    </td>
                    <td className={`num px-3 py-2.5 text-right ${s.avgTrades < 20 ? 'text-loss' : 'text-fg-muted'}`}>{s.avgTrades == null ? '–' : Math.round(s.avgTrades)}</td>
                    {hasSupply && <td className="px-3 py-2.5 text-right"><Delta value={s.supplyChange} /></td>}
                    <td className="py-2.5 pl-3 pr-5 text-right text-xs text-fg-dim">{CONFIDENCE_LABEL[s.confidence]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Explain title="Cách đọc bảng">
        <p>Đề xuất dựa vào vòng mùa 4 tuần: mỗi món có ngày trong vòng thường rẻ và ngày thường đắt (vd Corn đắt nhất mùa đông, Onion đắt nhất đầu mùa đông vì Lava Pit).</p>
        <p><b className="text-buy">Mua</b>: chênh đáy–đỉnh sau thuế ≥ 15%, đúng hướng ở ≥ 70% số vòng trước, đủ thanh khoản, và hôm nay đang ở khúc đáy (trước ngày đỉnh không còn ngày rẻ hơn ≥ 2%). Chỉ giữ top {signals?.topN ?? 2} món tốt nhất.</p>
        {signals?.buyMode === 'now'
          ? <p><b className="text-sun-300">Chờ</b>: chưa tới đáy. Cột Giá mua ghi giá dự kiến lúc rẻ hơn (dấu ~), tới ngày đó món nào lọt top thì tự chuyển sang Mua. Giá bán = giá đỉnh dự kiến.</p>
          : <p>Giá mua = giá đáy dự kiến trong 28 ngày tới (+5% cho dễ khớp), không cao hơn mức để bán ở giá mục tiêu trừ thuế còn lãi ≥ 15%: đặt offer tới ngày hẹn, không khớp thì huỷ. "khó khớp" = thấp hơn mọi giá 28 ngày qua.</p>}
        <p><b className="text-sell">Bán nếu đang giữ</b>: trong 7 ngày tới giá thường giảm ≥ 10%.</p>
        <p><b className="text-fg-muted">Đang theo dõi</b>: món mà mua ở đáy, bán ở đỉnh của vòng mùa (tính lùi từng vòng, không nhìn trước) ra lãi TB ≥ 10% sau thuế, thắng ≥ 50%, đủ ≥ 4 vòng, cộng món đang báo Mua. Món giá đi đều hoặc lịch sử lỗ bị ẩn, nhưng máy vẫn quét để không bỏ lỡ.</p>
        <p>Vòng mùa = chênh đáy–đỉnh sau thuế · tỉ lệ vòng đúng hướng. Supply chỉ được dùng khi đã thu đủ ~60 ngày.</p>
      </Explain>
    </Card>
  );
}

/* ---------- Toàn chợ ---------- */

function RankList({ rows, render, onPick, empty }) {
  if (!rows.length) return <EmptyState icon="🗂️">{empty}</EmptyState>;
  return (
    <ol className="max-h-[300px] overflow-y-auto">
      {rows.map((r, i) => (
        <li key={r.item}>
          <button type="button" onClick={() => onPick(r.item)} className="flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-ink-850">
            <span className="num w-5 text-[11px] text-fg-dim">{i + 1}</span>
            <ItemIcon item={r.item} size={24} />
            <span className="flex-1 truncate text-sm text-fg">{r.item}</span>
            {render(r)}
          </button>
        </li>
      ))}
    </ol>
  );
}

function MarketOverview({ flipKey, refreshKey, cal, onPick }) {
  const [range, setRange] = useState('7D');
  const [category, setCategory] = useState('all');
  const [season, setSeason] = useState('all');
  const [moverDir, setMoverDir] = useState('up');
  const overview = useApi(() => api.overview(flipKey, range), [flipKey, range, refreshKey]);
  const items = overview.data?.items || [];
  const filtered = items.filter(r => (category === 'all' || r.category === category) && (season === 'all' || (r.seasons || []).includes(season)));
  const byVolume = filtered.filter(r => r.volume > 0).sort((a, b) => b.volume - a.volume);
  const movers = filtered.filter(r => r.priceChange != null).sort((a, b) => (moverDir === 'up' ? b.priceChange - a.priceChange : a.priceChange - b.priceChange));
  const supplyMovers = filtered.filter(r => r.supplyChange != null).sort((a, b) => Math.abs(b.supplyChange) - Math.abs(a.supplyChange));
  const totalVolume = byVolume.reduce((a, r) => a + r.volume, 0);
  const categories = cal?.categories || [];
  const countBy = id => items.filter(r => r.category === id).length;
  const seasonTag = s => (cal?.current?.season === s ? 'NAY' : cal?.upcoming?.[1]?.season === s ? 'SAU' : null);
  const coverage = overview.data?.coverage;
  const colHead = 'px-5 pt-4 pb-2';

  return (
    <Card icon="🏪" title="Toàn chợ"
      subtitle={overview.data ? `Giá bằng SFL · cập nhật ${fmtAgo(overview.data.updatedAt)}${coverage ? ` · có ${coverage.dailyDays} ngày giá, ${coverage.supplyDays} ngày supply` : ''}` : 'Đang tải...'}
      right={<Segmented options={RANGES} value={range} onChange={setRange} size="sm" />}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-3">
        <Chip active={category === 'all'} onClick={() => setCategory('all')} count={items.length}>Tất cả</Chip>
        {categories.map(c => countBy(c.id) > 0 && (
          <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} count={countBy(c.id)}>{c.label}</Chip>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
        {Object.entries(SEASON_META).map(([id, m]) => (
          <Chip key={id} active={season === id} onClick={() => setSeason(season === id ? 'all' : id)} tag={seasonTag(id)}>{m.icon} {m.short}</Chip>
        ))}
      </div>
      <ErrorNote error={overview.error} onRetry={overview.reload} />
      {!overview.data && overview.loading ? <EmptyState icon="⏳" title="Đang tải dữ liệu chợ..." /> : !items.length ? (
        <EmptyState icon="📭" title="Chưa có dữ liệu chợ trong hệ thống">
          Server tự chụp chợ 15 phút/lần (cần SFL_API_KEY). Bấm Đồng bộ sau vài phút để xem.
        </EmptyState>
      ) : (
        <div className="grid divide-y divide-line-soft lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          <div>
            <div className={colHead}>
              <div className="text-xs font-medium text-fg-dim">Giá trị khớp · {RANGE_LABEL[range]}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="num text-2xl font-bold text-sun-300">{fmtCompact(totalVolume)}</span>
                <span className="text-xs text-fg-dim">SFL</span>
                {overview.data?.totals?.volumeChange != null && category === 'all' && season === 'all' && <Delta value={overview.data.totals.volumeChange} />}
              </div>
            </div>
            <RankList rows={byVolume} onPick={onPick} empty="Không có giao dịch trong khoảng này"
              render={r => <span className="num text-[11px] text-fg-muted">{fmtCompact(r.volume)} <span className="text-fg-dim">· {totalVolume ? ((r.volume / totalVolume) * 100).toFixed(1) : 0}%</span></span>} />
          </div>
          <div>
            <div className={`${colHead} flex items-start justify-between gap-2`}>
              <div>
                <div className="text-xs font-medium text-fg-dim">Biến động giá</div>
                <div className="num mt-1 text-sm text-fg-muted">
                  <span className="text-buy">{movers.filter(r => r.priceChange > 0.01).length} tăng</span> · {movers.filter(r => Math.abs(r.priceChange) <= 0.01).length} đứng · <span className="text-loss">{movers.filter(r => r.priceChange < -0.01).length} giảm</span>
                </div>
              </div>
              <Segmented size="sm" options={[{ id: 'up', label: 'Tăng' }, { id: 'down', label: 'Giảm' }]} value={moverDir} onChange={setMoverDir} />
            </div>
            <RankList rows={movers} onPick={onPick} empty="Cần ít nhất 2 ngày giá để tính biến động" render={r => <Delta value={r.priceChange} />} />
          </div>
          <div>
            <div className={colHead}>
              <div className="text-xs font-medium text-fg-dim">Cung ứng & người giữ</div>
              <div className="mt-1 text-sm text-fg-muted">Đổi active supply trong {RANGE_LABEL[range]}</div>
            </div>
            <RankList rows={supplyMovers} onPick={onPick}
              empty="Chưa đủ dữ liệu supply. Server đếm từ nightly dump mỗi ngày lúc 22:40 UTC, cần ít nhất 2 ngày."
              render={r => <span className="flex items-center gap-2"><span className="num text-[11px] text-fg-dim">{fmtCompact(r.holders)} người</span><Delta value={r.supplyChange} digits={2} /></span>} />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------- Theo dõi đề xuất thật ---------- */

const RECO_STATUS = {
  pending: { label: 'Đang chờ khớp', cls: 'text-sun-300' },
  expired: { label: 'Không khớp', cls: 'text-fg-dim' },
  holding: { label: 'Đã khớp, chờ bán', cls: 'text-info' },
  done: { label: 'Xong', cls: 'text-fg' }
};

function RecoCard({ data, error, onRetry }) {
  const sm = data?.summary;
  const list = data?.list || [];
  return (
    <Card icon="📝" title="Đề xuất đã đưa ra & kết quả thật" subtitle="Mỗi món báo Mua được ghi 1 lần/ngày, rồi chấm bằng giá sàn 15 phút">
      <ErrorNote error={error} onRetry={onRetry} />
      {!sm || !sm.total ? <EmptyState icon="🗒️" title="Chưa có đề xuất nào được ghi">Server ghi lại 15 phút/lần, từ lúc chạy bản này.</EmptyState> : (
        <>
          <div className="grid grid-cols-2 gap-4 border-b border-line-soft px-5 py-4 sm:grid-cols-5">
            <Stat label="Đề xuất" value={sm.total} hint={`${sm.pending} đang chờ`} />
            <Stat label="Tỉ lệ khớp" value={sm.fillRate == null ? '–' : `${Math.round(sm.fillRate * 100)}%`} />
            <Stat label="Đang giữ" value={sm.holding} />
            <Stat label="Đã xong" value={sm.done} hint={sm.done ? `thắng ${Math.round(sm.winRate * 100)}% · TB ${fmtPct(sm.avgReturn)}` : null} tone={sm.done && sm.avgReturn >= 0 ? 'buy' : 'fg'} />
            <Stat label="Mày đã mua theo" value={sm.userBought} />
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="sticky top-0 border-b border-line-soft bg-ink-900">
                <tr>
                  <th className={`${TH} pl-5 text-left`}>Ngày</th><th className={`${TH} text-left`}>Món</th><th className={`${TH} text-right`}>Mua</th><th className={`${TH} text-right`}>Tới</th>
                  <th className={`${TH} text-right`}>Bán</th><th className={`${TH} text-left`}>Trạng thái</th><th className={`${TH} text-right`}>Lãi</th><th className={`${TH} pr-5 text-right`}>Mày mua</th>
                </tr>
              </thead>
              <tbody className="num divide-y divide-line-soft">
                {list.map(r => {
                  const st = RECO_STATUS[r.eval?.status || 'pending'];
                  const ret = r.eval?.status === 'done' ? r.eval.ret : r.eval?.markRet;
                  return (
                    <tr key={`${r.date}|${r.item}`}>
                      <td className="py-2 pl-5 pr-3 text-fg-dim">{fmtDay(r.date)}</td>
                      <td className="px-3 py-2 font-medium text-fg">{r.item}</td>
                      <td className="px-3 py-2 text-right text-buy">{fmtPrice(r.buyPrice)}</td>
                      <td className="px-3 py-2 text-right text-fg-dim">{fmtDay(r.buyBy)}</td>
                      <td className="px-3 py-2 text-right text-sell">{fmtPrice(r.sellTarget)}</td>
                      <td className={`px-3 py-2 ${st.cls}`}>{st.label}{r.eval?.reason === 'timeout' ? ' (hết hạn bán)' : ''}</td>
                      <td className="px-3 py-2 text-right">{ret == null ? '–' : <Delta value={ret} />}</td>
                      <td className="py-2 pl-3 pr-5 text-right text-fg-muted">{r.userBuys?.length ? fmtCompact(r.userBuys.reduce((a, b) => a + b.qty, 0)) : '–'}</td>
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

/* ---------- Trang ---------- */

export default function MarketPage({ flipKey, refreshKey }) {
  const [picked, setPicked] = useState(null);
  const calendar = useApi(() => api.calendar(flipKey), [flipKey, refreshKey]);
  const signals = useApi(() => api.signals(flipKey), [flipKey, refreshKey]);
  const holdings = useApi(() => api.holdings(flipKey), [flipKey, refreshKey]);
  const recos = useApi(() => api.recos(flipKey), [flipKey, refreshKey]);

  return (
    <div className="space-y-6">
      <ErrorNote error={signals.error} onRetry={signals.reload} />
      <div className="grid gap-6">
        <TodayBuys signals={signals.data} loading={signals.loading} onPick={setPicked} />
        <SeasonStrip cal={calendar.data} onPick={setPicked} />
      </div>
      <HoldingsCard flipKey={flipKey} data={holdings.data} error={holdings.error} loading={holdings.loading} onRetry={holdings.reload} onPick={setPicked} />
      <WatchTable signals={signals.data} loading={signals.loading} onPick={setPicked} />
      <MarketOverview flipKey={flipKey} refreshKey={refreshKey} cal={calendar.data} onPick={setPicked} />
      <RecoCard data={recos.data} error={recos.error} onRetry={recos.reload} />
      {picked && <ItemDetail item={picked} flipKey={flipKey} refreshKey={refreshKey} onClose={() => setPicked(null)} />}
    </div>
  );
}
