import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';
import PriceChart from '../components/PriceChart';
import { DecisionBadge, EmptyState, ErrorNote, ItemIcon, Segmented, SeasonTags } from '../components/ui';
import { CONFIDENCE_LABEL, SEASON_META, fmtCompact, fmtPct, fmtPrice, fmtAgo } from '../lib/format';

const GRANULARITIES = [{ id: '15m', label: '15m' }, { id: '1h', label: '1H' }, { id: '4h', label: '4H' }, { id: '1d', label: '1D' }];
const RANGES = ['1D', '3D', '7D', '30D', '90D'];

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-line bg-ink-850 px-3 py-2 min-w-[96px]">
      <div className="text-[11px] font-medium text-fg-dim">{label}</div>
      <div className="text-sm font-bold text-fg tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-fg-muted">{sub}</div>}
    </div>
  );
}

/** Cửa sổ lịch sử giá 1 tài nguyên (giống trang Price History của site mẫu) + lý do đề xuất */
export default function ItemDetail({ item, flipKey, refreshKey, onClose }) {
  const [mode, setMode] = useState('line');
  const [granularity, setGranularity] = useState('1d');
  const [range, setRange] = useState('30D');
  const { data, error, loading, reload } = useApi(() => api.item(flipKey, item, { granularity, range }), [flipKey, item, granularity, range, refreshKey]);

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Nến 15m chỉ hợp với khoảng ngắn: tự đổi cho hợp lý
  const pickGranularity = g => {
    setGranularity(g);
    if (g === '15m' && ['30D', '90D'].includes(range)) setRange('3D');
    if (g === '1d' && ['1D', '3D'].includes(range)) setRange('30D');
  };

  const s = data?.stats;
  const sig = data?.signal;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-2 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-2xl border border-line bg-ink-900 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-start gap-4 border-b border-line p-4 sm:p-5">
          <ItemIcon item={item} size={56} />
          <div className="flex-1 min-w-[200px] space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-fg">Lịch sử giá / {item}</h2>
              <SeasonTags seasons={data?.seasons} />
            </div>
            {s && (
              <div className="flex flex-wrap gap-2">
                <Stat label="Giá" value={`${fmtPrice(s.price)} SFL`} />
                <Stat label="Đổi 30 ngày" value={<span className={s.change30d >= 0 ? 'text-buy' : 'text-loss'}>{fmtPct(s.change30d)}</span>} />
                <Stat label="Offer cao nhất" value={fmtPrice(s.bestOffer)} />
                <Stat label="Listing / Offer" value={`${s.listings ?? '–'} / ${s.offers ?? '–'}`} />
                <Stat label="Active supply" value={fmtCompact(s.supply)} sub={s.holders != null ? `${fmtCompact(s.holders)} người giữ` : null} />
                <Stat label="Hôm nay" value={`${fmtCompact(s.volumeToday)} SFL`} sub={s.tradesToday != null ? `${fmtCompact(s.tradesToday)} lệnh` : null} />
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-xl leading-none text-fg-muted hover:bg-ink-800 hover:text-fg" aria-label="Đóng">×</button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-4 sm:px-5">
          <Segmented size="sm" options={[{ id: 'line', label: 'Đường' }, { id: 'candle', label: 'Nến' }]} value={mode} onChange={setMode} />
          <Segmented size="sm" options={GRANULARITIES} value={granularity} onChange={pickGranularity} />
          <Segmented size="sm" options={RANGES} value={range} onChange={setRange} />
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          <ErrorNote error={error} onRetry={reload} />
          <div className="rounded-xl border border-line bg-ink-950 p-2">
            <div className="flex flex-wrap items-center gap-4 px-2 pb-1 text-[11px] text-fg-muted">
              <span><span className="text-sun-400">●</span> Giá SFL (trục phải)</span>
              {data?.supply?.length > 0 && <span><span className="text-info">●</span> Active supply (trục trái)</span>}
              {sig?.buyPrice && <span><span className="text-buy">- -</span> Giá mua đề xuất</span>}
              {sig?.sellTarget && <span><span className="text-sell">- -</span> Giá bán mục tiêu</span>}
              <span className="ml-auto flex gap-2">{Object.entries(SEASON_META).map(([k, m]) => <span key={k} style={{ color: m.color }}>■ {m.short}</span>)}</span>
            </div>
            {data && data.candles.length > 1 ? (
              <PriceChart candles={data.candles} supply={data.supply} seasonBands={data.seasonBands} mode={mode}
                buyPrice={sig?.decision !== 'none' ? sig?.buyPrice : null} sellTarget={sig?.decision !== 'none' ? sig?.sellTarget : null} />
            ) : (
              <EmptyState icon={loading ? '⏳' : '📉'} title={loading ? 'Đang tải dữ liệu...' : 'Chưa có đủ dữ liệu để vẽ'}>
                {!loading && (granularity === '1d'
                  ? 'Dữ liệu theo ngày đang được lấp dần từ API khi server khởi động. Đợi vài phút rồi bấm Đồng bộ.'
                  : 'Dữ liệu 15 phút chỉ có từ lúc server bắt đầu chụp chợ. Thử khung 1D để xem lịch sử dài hơn.')}
              </EmptyState>
            )}
          </div>
          {data && <div className="text-[11px] text-fg-dim">Cập nhật {fmtAgo(data.updatedAt)} · {data.stats.candles} nến · giờ theo máy của bạn</div>}

          {sig && (
            <div className="rounded-xl border border-line bg-ink-850 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-fg">Đề xuất</span>
                <DecisionBadge decision={sig.decision} />
                {sig.decision !== 'none' && (
                  <>
                    {sig.buyPrice > 0
                      ? <span className="text-sm text-fg-muted">Mua ≤ <b className="text-buy">{fmtPrice(sig.buyPrice)}</b></span>
                      : sig.buyBelow3mLow && <span className="text-sm text-fg-muted">Không đặt offer: giá mua đủ lãi thấp hơn đáy 3 tháng ({fmtPrice(sig.low3m)})</span>}
                    <span className="text-sm text-fg-muted">Bán ~ <b className="text-sell">{fmtPrice(sig.sellTarget)}</b></span>
                    {sig.buyBy && <span className="text-sm text-fg-muted">Offer tới <b className="text-buy">{new Date(`${sig.buyBy}T00:00:00Z`).toLocaleDateString('vi-VN')}</b></span>}
                    {sig.sellBy && <span className="text-sm text-fg-muted">Bán chậm nhất <b className="text-sell">{new Date(`${sig.sellBy}T00:00:00Z`).toLocaleDateString('vi-VN')}</b></span>}
                    {sig.netMargin != null && <span className="text-sm text-fg-muted">Lãi ròng <b className={sig.netMargin >= 0 ? 'text-buy' : 'text-loss'}>{fmtPct(sig.netMargin)}</b></span>}
                    <span className="text-xs text-fg-dim">Điểm {sig.score}/100 · tin cậy {CONFIDENCE_LABEL[sig.confidence]} · thuế {fmtPct(data.taxRate, 1).replace('+', '')}</span>
                  </>
                )}
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs text-fg-muted">
                {sig.reasons.map(r => <li key={r}>{r}</li>)}
              </ul>
              {sig.cycle?.profile && <CycleBars cycle={sig.cycle} />}
              {sig.backtest?.trades > 0 && (
                <div className="rounded-lg border border-line bg-ink-950 p-3 space-y-2">
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-muted">
                    <span className="font-bold text-fg">Backtest luật cũ (phân vị giá 30 ngày)</span>
                    <span>{sig.backtest.trades} lệnh</span>
                    <span>Thắng {Math.round(sig.backtest.winRate * 100)}%</span>
                    <span>Lãi TB <b className={sig.backtest.avgReturn >= 0 ? 'text-buy' : 'text-loss'}>{fmtPct(sig.backtest.avgReturn)}</b>/lệnh</span>
                    <span>Giữ TB {sig.backtest.avgHoldDays.toFixed(1)} ngày</span>
                    <span>Lệnh tệ nhất {fmtPct(sig.backtest.worst)}</span>
                    {sig.backtestNoTrend?.trades > 0 && (
                      <span className="text-fg-dim">Nếu không lọc xu hướng: {sig.backtestNoTrend.trades} lệnh, lãi TB {fmtPct(sig.backtestNoTrend.avgReturn)}</span>
                    )}
                  </div>
                  {sig.backtestTrades?.length > 0 && (
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-[11px] tabular-nums">
                        <thead className="text-fg-dim"><tr><th className="text-left">Mua</th><th className="text-right">Giá mua</th><th className="text-left pl-4">Bán</th><th className="text-right">Giá bán</th><th className="text-right">Lãi sau thuế</th><th className="text-right">Lý do bán</th></tr></thead>
                        <tbody>
                          {sig.backtestTrades.slice().reverse().map(t => (
                            <tr key={t.buyDate} className="text-fg-muted">
                              <td>{t.buyDate}</td><td className="text-right">{fmtPrice(t.buy)}</td>
                              <td className="pl-4">{t.sellDate}</td><td className="text-right">{fmtPrice(t.sell)}</td>
                              <td className={`text-right ${t.ret >= 0 ? 'text-buy' : 'text-loss'}`}>{fmtPct(t.ret)}</td>
                              <td className="text-right text-fg-dim">{t.reason === 'target' ? 'chạm giá bán' : t.reason === 'timeout' ? 'giữ quá 28 ngày' : 'hết dữ liệu'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
              <p className="text-[11px] text-fg-dim">Đề xuất tính theo luật từ dữ liệu đã lưu (phân vị giá 30 ngày, xu hướng, chu kỳ mùa và theo thứ, nhu cầu Lava Pit, supply, thanh khoản, thuế, backtest). Đây là gợi ý tham khảo, không đảm bảo lãi.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];

/** Giá thường lệch bao nhiêu % so với mặt bằng ở từng ngày của vòng mùa 4 tuần; cột viền trắng là hôm nay */
function CycleBars({ cycle }) {
  const max = Math.max(0.05, ...cycle.profile.map(v => Math.abs(v)));
  return (
    <div className="rounded-lg border border-line bg-ink-950 p-3">
      <div className="mb-2 text-xs font-bold text-fg">Giá theo vòng mùa (so với mặt bằng 28 ngày)</div>
      <div className="flex h-24 items-center gap-[2px]">
        {cycle.profile.map((v, k) => (
          <div key={k} className="relative flex h-full flex-1 flex-col justify-center" title={`${SEASON_META[SEASON_ORDER[Math.floor(k / 7)]].label} ngày ${(k % 7) + 1}: ${fmtPct(v)}`}>
            <div className="flex h-1/2 items-end"><div className={`w-full rounded-t ${k === cycle.slot ? 'ring-1 ring-white' : ''}`} style={{ height: `${v > 0 ? (v / max) * 100 : 0}%`, background: SEASON_META[SEASON_ORDER[Math.floor(k / 7)]].color }} /></div>
            <div className="flex h-1/2 items-start"><div className={`w-full rounded-b opacity-60 ${k === cycle.slot ? 'ring-1 ring-white' : ''}`} style={{ height: `${v < 0 ? (-v / max) * 100 : 0}%`, background: SEASON_META[SEASON_ORDER[Math.floor(k / 7)]].color }} /></div>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-4 text-center text-[10px] text-fg-muted">
        {SEASON_ORDER.map(s => <span key={s}>{SEASON_META[s].icon} {SEASON_META[s].label} {fmtPct(cycle.seasonAvg[s], 0)}</span>)}
      </div>
    </div>
  );
}
