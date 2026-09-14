import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { getAssetUrl } from '../utils/gameConstants';

const MarketCandlestickChart = ({ itemName, onClose, isTracked, onToggleTrack, currentPrice }) => {
  const chartContainerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  
  const [granularity, setGranularity] = useState('1d');
  const [chartType, setChartType] = useState('candle'); // 'candle' | 'line'
  const [timeRange, setTimeRange] = useState('ALL'); // '24H', '7D', '30D', 'ALL'
  const [showSupply, setShowSupply] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [crosshairData, setCrosshairData] = useState(null);
  const [stats, setStats] = useState({
    high: 0,
    low: 0,
    changePercent: 0,
    volume: 0,
  });

  useEffect(() => {
    let chart;
    let mainSeries;
    let volumeSeries;
    let supplySeries;

    const fetchAndRender = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        
        let limit = 500;
        const limitMap = { '15m': 1000, '1h': 500, '4h': 300, '1d': 180 };
        if (timeRange === '24H') {
          limit = granularity === '15m' ? 96 : granularity === '1h' ? 24 : granularity === '4h' ? 6 : 1;
        } else if (timeRange === '7D') {
          limit = granularity === '15m' ? 672 : granularity === '1h' ? 168 : granularity === '4h' ? 42 : 7;
        } else if (timeRange === '30D') {
          limit = granularity === '15m' ? 2880 : granularity === '1h' ? 720 : granularity === '4h' ? 180 : 30;
        } else {
          limit = limitMap[granularity] || 500;
        }
        
        const res = await fetch(`${apiUrl}/api/market/history/${encodeURIComponent(itemName)}?granularity=${granularity}&limit=${limit}`);
        const json = await res.json();
        
        if (json.success && json.data) {
          const rawData = json.data;
          setData(rawData);
          
          if (rawData.length > 0) {
            const firstCandle = rawData[0];
            const lastCandle = rawData[rawData.length - 1];
            const high = Math.max(...rawData.map(d => d.high));
            const low = Math.min(...rawData.map(d => d.low));
            const totalVol = rawData.reduce((acc, d) => acc + (d.volume || 0), 0);
            
            let change = 0;
            if (firstCandle.open > 0) {
              change = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;
            }
            
            setStats({
              high, low, 
              changePercent: change,
              volume: totalVol
            });
            
            setCrosshairData({
              time: lastCandle.time,
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close,
              volume: lastCandle.volume || 0,
              supply: lastCandle.supply || 0
            });
          }
          
          if (chartContainerRef.current) {
            chartContainerRef.current.innerHTML = '';
            
            if (rawData.length > 0) {
              chart = createChart(chartContainerRef.current, {
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
                layout: {
                  background: { type: 'solid', color: 'transparent' },
                  textColor: '#94a3b8',
                },
                grid: {
                  vertLines: { color: 'rgba(51, 65, 85, 0.3)' },
                  horzLines: { color: 'rgba(51, 65, 85, 0.3)' },
                },
                crosshair: {
                  mode: CrosshairMode.Normal,
                  vertLine: { 
                    width: 1, color: 'rgba(148, 163, 184, 0.5)', style: LineStyle.Dashed,
                    labelBackgroundColor: '#334155' 
                  },
                  horzLine: { 
                    width: 1, color: 'rgba(148, 163, 184, 0.5)', style: LineStyle.Dashed,
                    labelBackgroundColor: '#334155' 
                  },
                },
                timeScale: {
                  timeVisible: true,
                  secondsVisible: false,
                  borderColor: 'rgba(51, 65, 85, 0.8)',
                },
                rightPriceScale: {
                  borderColor: 'rgba(51, 65, 85, 0.8)',
                  autoScale: true,
                },
                leftPriceScale: {
                  visible: showSupply,
                  borderColor: 'rgba(51, 65, 85, 0.8)',
                  autoScale: true,
                }
              });

              if (chartType === 'candle') {
                mainSeries = chart.addCandlestickSeries({
                  upColor: '#22c55e', downColor: '#ef4444',
                  borderVisible: false,
                  wickUpColor: '#22c55e', wickDownColor: '#ef4444',
                  priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
                });
              } else {
                mainSeries = chart.addLineSeries({
                  color: '#3b82f6', lineWidth: 2,
                  crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
                  priceFormat: { type: 'price', precision: 6, minMove: 0.000001 },
                });
              }
              
              mainSeries.setData(rawData.map(d => ({
                time: Math.floor(d.time),
                open: d.open, high: d.high, low: d.low, close: d.close, value: d.close,
              })));
              
              if (showSupply) {
                supplySeries = chart.addLineSeries({
                  color: '#b39ddb',
                  priceScaleId: 'left',
                  lineWidth: 2,
                });
                supplySeries.setData(rawData.map(d => ({
                  time: Math.floor(d.time),
                  value: d.supply || 0
                })));
              }
              
              volumeSeries = chart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: 'vol', 
              });
              
              chart.priceScale('vol').applyOptions({
                scaleMargins: { top: 0.85, bottom: 0 },
                visible: false,
              });
              
              volumeSeries.setData(rawData.map(d => ({
                time: Math.floor(d.time),
                value: d.volume || 0,
                color: d.close >= d.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
              })));

              chart.timeScale().fitContent();

              chart.subscribeCrosshairMove((param) => {
                if (
                  param.point === undefined || !param.time ||
                  param.point.x < 0 || param.point.x > chartContainerRef.current.clientWidth ||
                  param.point.y < 0 || param.point.y > chartContainerRef.current.clientHeight
                ) {
                  const last = rawData[rawData.length - 1];
                  setCrosshairData({
                    time: last.time, open: last.open, high: last.high, low: last.low, close: last.close,
                    volume: last.volume || 0, supply: last.supply || 0
                  });
                } else {
                  const dataPoint = param.seriesData.get(mainSeries);
                  const volPoint = param.seriesData.get(volumeSeries);
                  const supPoint = supplySeries ? param.seriesData.get(supplySeries) : null;
                  
                  if (dataPoint) {
                    setCrosshairData({
                      time: param.time,
                      open: dataPoint.open !== undefined ? dataPoint.open : dataPoint.value,
                      high: dataPoint.high !== undefined ? dataPoint.high : dataPoint.value,
                      low: dataPoint.low !== undefined ? dataPoint.low : dataPoint.value,
                      close: dataPoint.close !== undefined ? dataPoint.close : dataPoint.value,
                      volume: volPoint ? volPoint.value : 0,
                      supply: supPoint ? supPoint.value : 0
                    });
                  }
                }
              });

              const handleResize = () => {
                if (chartContainerRef.current && chart) {
                  chart.applyOptions({ 
                    width: chartContainerRef.current.clientWidth,
                    height: chartContainerRef.current.clientHeight
                  });
                }
              };
              window.addEventListener('resize', handleResize);
              setTimeout(handleResize, 50);
              
              return () => {
                window.removeEventListener('resize', handleResize);
                if (chart) chart.remove();
              };
            }
          }
        } else {
          setError(json.error || "Không tìm thấy dữ liệu lịch sử.");
        }
      } catch (err) {
        console.error("Error loading chart:", err);
        setError("Lỗi khi tải dữ liệu biểu đồ: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAndRender();
  }, [itemName, granularity, chartType, timeRange, showSupply, isFullscreen]); // re-render when fullscreen changes size

  const formatNum = (num, minDecimals = 4, maxDecimals = 6) => {
    if (num === undefined || num === null) return '0.0000';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals });
  };
  
  const formatVol = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  const getCrosshairColor = (open, close) => {
    return close >= open ? 'text-emerald-400' : 'text-rose-400';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const d = new Date(timestamp * 1000);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-full rounded-xl'} flex flex-col bg-[#161a25] overflow-hidden shadow-2xl relative border border-slate-700/50`}>
      {/* Top Header - TradingView Style */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between p-3 border-b border-slate-700/50 bg-[#1e222d] gap-3">
        {/* Left: Asset Info */}
        <div className="flex items-center justify-between xl:justify-start w-full xl:w-auto gap-4">
          <div className="flex items-center gap-3">
            <img src={getAssetUrl(itemName)} className="w-8 h-8 object-contain drop-shadow-md" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 leading-none">{itemName}</h2>
                <button onClick={onToggleTrack} className="text-slate-400 hover:text-amber-400 transition-colors" title={isTracked ? "Bỏ theo dõi" : "Thêm vào danh sách theo dõi"}>
                  <svg className={`w-4 h-4 ${isTracked ? 'text-amber-400 fill-amber-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
              </div>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5">ID: {itemName} - Nến {granularity}</span>
            </div>
          </div>
          <button onClick={onClose} className="xl:hidden text-slate-500 hover:text-rose-400 p-1 rounded-md bg-slate-800/50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Middle: Stats */}
        {!loading && !error && (
          <div className="flex items-center gap-4 lg:gap-8 overflow-x-auto custom-scrollbar pb-1 xl:pb-0 flex-1 justify-center xl:px-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Giá Hiện Tại</span>
              <span className={`text-sm font-bold ${stats.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currentPrice > 0 ? formatNum(currentPrice) : (crosshairData ? formatNum(crosshairData.close) : '0.0000')}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Thay đổi</span>
              <span className={`text-sm font-bold ${stats.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.changePercent > 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex flex-col hidden sm:flex">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Cao nhất</span>
              <span className="text-sm font-bold text-emerald-400">{formatNum(stats.high)}</span>
            </div>
            <div className="flex flex-col hidden sm:flex">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Thấp nhất</span>
              <span className="text-sm font-bold text-rose-400">{formatNum(stats.low)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Volume</span>
              <span className="text-sm font-bold text-blue-400">{formatVol(stats.volume)}</span>
            </div>
            <div className="flex flex-col hidden md:flex">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Số Nến</span>
              <span className="text-sm font-bold text-slate-300">{data.length}</span>
            </div>
          </div>
        )}

        <button onClick={onClose} className="hidden xl:flex text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 p-1.5 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#161a25] border-b border-slate-700/30 gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/50 p-0.5 rounded-md border border-slate-700/50">
            <button onClick={() => setChartType('candle')} className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${chartType === 'candle' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Nến</button>
            <button onClick={() => setChartType('line')} className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${chartType === 'line' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Line</button>
          </div>
          <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer ml-2">
            <input type="checkbox" checked={showSupply} onChange={(e) => setShowSupply(e.target.checked)} className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500" />
            <span className="text-[#b39ddb] font-medium">Supply</span>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {['15m', '1h', '4h', '1d'].map(tf => (
              <button key={tf} onClick={() => setGranularity(tf)} className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${granularity === tf ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-slate-200'}`}>
                {tf}
              </button>
            ))}
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-1">
            {['24H', '7D', '30D', 'ALL'].map(tr => (
              <button key={tr} onClick={() => setTimeRange(tr)} className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${timeRange === tr ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'}`}>
                {tr}
              </button>
            ))}
          </div>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-slate-400 hover:text-emerald-400 ml-2 p-1 bg-slate-800/50 rounded" title="Phóng to">
            {isFullscreen ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l-4 4m0 0l4 4m-4-4h14M15 13l4-4m0 0l-4-4m4 4H5" /></svg> // minimize icon
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg> // maximize icon
            )}
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="relative flex-1 w-full min-h-[350px]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#131722]/80 z-20 backdrop-blur-sm">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <span className="text-blue-400 font-semibold text-sm">Đang tải dữ liệu...</span>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#131722]">
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          </div>
        )}

        {!loading && data.length === 0 && !error && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-[#131722]">
             <div className="text-slate-400 text-sm italic p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                Chưa có dữ liệu lịch sử.
             </div>
          </div>
        )}

        {/* Inline Legend Overlay */}
        {crosshairData && (
          <div className={`absolute top-2 ${showSupply ? 'left-[70px]' : 'left-2'} z-10 flex items-center flex-wrap gap-x-3 gap-y-1 text-xs font-mono bg-transparent pointer-events-none`}>
            <div className="text-slate-300 font-sans font-semibold">Nến OHLCV {granularity} • {formatDate(crosshairData.time)}</div>
            <div className="flex gap-2">
              <span className="text-slate-500">O<span className={`ml-1 ${getCrosshairColor(crosshairData.open, crosshairData.close)}`}>{formatNum(crosshairData.open)}</span></span>
              <span className="text-slate-500">H<span className={`ml-1 ${getCrosshairColor(crosshairData.open, crosshairData.close)}`}>{formatNum(crosshairData.high)}</span></span>
              <span className="text-slate-500">L<span className={`ml-1 ${getCrosshairColor(crosshairData.open, crosshairData.close)}`}>{formatNum(crosshairData.low)}</span></span>
              <span className="text-slate-500">C<span className={`ml-1 ${getCrosshairColor(crosshairData.open, crosshairData.close)}`}>{formatNum(crosshairData.close)}</span></span>
            </div>
            {crosshairData.volume > 0 && (
              <span className="text-slate-500">Vol <span className="text-blue-400 ml-1">{formatVol(crosshairData.volume)}</span></span>
            )}
            {crosshairData.supply > 0 && showSupply && (
              <span className="text-slate-500">Supply <span className="text-[#b39ddb] ml-1">{formatVol(crosshairData.supply)}</span></span>
            )}
          </div>
        )}

        {/* Lightweight Chart Container */}
        <div ref={chartContainerRef} className="absolute inset-0" />
      </div>
    </div>
  );
};

export default MarketCandlestickChart;
