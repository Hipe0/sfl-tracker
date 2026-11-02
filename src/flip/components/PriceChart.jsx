import { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { SEASON_META, fmtPrice, fmtCompact } from '../lib/format';

const toSec = ms => Math.floor(ms / 1000);

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Bỏ điểm trùng thời gian (lightweight-charts yêu cầu tăng dần, không trùng) */
function uniqueByTime(points) {
  const out = [];
  for (const p of points) {
    if (out.length && out[out.length - 1].time === p.time) out[out.length - 1] = p;
    else if (!out.length || p.time > out[out.length - 1].time) out.push(p);
  }
  return out;
}

const EMPTY = [];

/**
 * Biểu đồ giá (line/candle) trục phải, active supply trục trái, cột volume ở đáy,
 * nền tô màu theo mùa, đường giá mua/bán đề xuất.
 */
export default function PriceChart({ candles = [], supply: supplyIn = [], seasonBands = [], mode = 'line', buyPrice, sellTarget, height = 380 }) {
  const ref = useRef(null);
  // 1 điểm supply thì trục trái vô nghĩa (tự co quanh đúng 1 số), cần ít nhất 2 ngày mới vẽ
  const supply = supplyIn.length >= 2 ? supplyIn : EMPTY;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const chart = createChart(el, {
      height,
      width: el.clientWidth,
      layout: { background: { color: 'transparent' }, textColor: '#94a3b8', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(148,163,184,0.06)' }, horzLines: { color: 'rgba(148,163,184,0.08)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.2)' },
      leftPriceScale: { visible: supply.length > 0, borderColor: 'rgba(148,163,184,0.2)' },
      timeScale: { borderColor: 'rgba(148,163,184,0.2)', timeVisible: true, secondsVisible: false },
      // không đặt localization.priceFormatter: nó đè formatter của từng series (trục supply bị in theo kiểu giá)
    });

    const times = candles.map(c => toSec(c.time));

    // Nền theo mùa: cột cao kín biểu đồ trên thang riêng
    if (seasonBands.length && times.length) {
      const bands = chart.addHistogramSeries({ priceScaleId: 'bands', lastValueVisible: false, priceLineVisible: false });
      chart.priceScale('bands').applyOptions({ scaleMargins: { top: 0, bottom: 0 }, visible: false });
      bands.setData(uniqueByTime(times.map(t => {
        const ms = t * 1000;
        const band = seasonBands.find(b => ms >= b.from && ms < b.to) || seasonBands[seasonBands.length - 1];
        return { time: t, value: 1, color: hexToRgba(SEASON_META[band.season]?.color || '#64748b', 0.13) };
      })));
    }

    // Volume
    const volume = chart.addHistogramSeries({ priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    volume.setData(uniqueByTime(candles.map(c => ({
      time: toSec(c.time),
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(16,185,129,0.45)' : 'rgba(244,63,94,0.45)'
    }))));

    // Giá
    let price;
    if (mode === 'candle') {
      price = chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#f43f5e', borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#f43f5e',
        priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 0.0000001 }
      });
      price.setData(uniqueByTime(candles.map(c => ({ time: toSec(c.time), open: c.open, high: c.high, low: c.low, close: c.close }))));
    } else {
      price = chart.addLineSeries({ color: '#facc15', lineWidth: 2, priceFormat: { type: 'custom', formatter: fmtPrice, minMove: 0.0000001 } });
      price.setData(uniqueByTime(candles.map(c => ({ time: toSec(c.time), value: c.close }))));
    }
    if (buyPrice > 0) price.createPriceLine({ price: buyPrice, color: '#10b981', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Mua' });
    if (sellTarget > 0) price.createPriceLine({ price: sellTarget, color: '#f97316', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'Bán' });

    // Active supply (trục trái)
    if (supply.length) {
      const sup = chart.addLineSeries({ priceScaleId: 'left', color: '#a78bfa', lineWidth: 2, priceFormat: { type: 'custom', formatter: fmtCompact } });
      sup.setData(uniqueByTime(supply.map(s => ({ time: toSec(Date.parse(`${s.date}T00:00:00Z`)), value: s.supply }))));
    }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: el.clientWidth }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, supply, seasonBands, mode, buyPrice, sellTarget, height]);

  return <div ref={ref} className="w-full" style={{ height }} />;
}
