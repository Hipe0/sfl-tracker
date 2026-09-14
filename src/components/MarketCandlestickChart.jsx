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

    const fetchAndRender = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        // Note: adjust limit based on granularity to get a good looking chart
        const limitMap = { '15m': 1000, '1h': 500, '4h': 300, '1d': 180 };
        const limit = limitMap[granularity] || 500;
        
        const res = await fetch(`${apiUrl}/api/market/history/${encodeURIComponent(itemName)}?granularity=${granularity}&limit=${limit}`);
        const json = await res.json();
        
        if (json.success && json.data) {
          const rawData = json.data;
          setData(rawData);
          
          if (rawData.length > 0) {
            // Calculate stats
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
            
            // Set initial crosshair to last candle
            setCrosshairData({
              time: lastCandle.time,
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close,
              volume: lastCandle.volume || 0
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
                  textColor: '#94a3b8', // text-slate-400
                },
                grid: {
                  vertLines: { color: 'rgba(51, 65, 85, 0.3)' }, // slate-700/30
                  horzLines: { color: 'rgba(51, 65, 85, 0.3)' },
                },
                crosshair: {
                  mode: CrosshairMode.Normal,
                  vertLine: {
                    width: 1,
                    color: 'rgba(148, 163, 184, 0.5)',
                    style: LineStyle.Dashed,
                  },
                  horzLine: {
                    width: 1,
                    color: 'rgba(148, 163, 184, 0.5)',
                    style: LineStyle.Dashed,
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
              });

              if (chartType === 'candle') {
                mainSeries = chart.addCandlestickSeries({
                  upColor: '#22c55e', // green-500
                  downColor: '#ef4444', // red-500
                  borderVisible: false,
                  wickUpColor: '#22c55e',
                  wickDownColor: '#ef4444',
                });
              } else {
                mainSeries = chart.addLineSeries({
                  color: '#3b82f6', // blue-500
                  lineWidth: 2,
                  crosshairMarkerVisible: true,
                  crosshairMarkerRadius: 4,
                  crosshairMarkerBorderColor: '#fff',
                  crosshairMarkerBackgroundColor: '#3b82f6',
                });
              }
              
              const seriesData = rawData.map(d => ({
                time: Math.floor(d.time),
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
                value: d.close, // For line series
              }));
              
              mainSeries.setData(seriesData);
              
              // Volume Series
              volumeSeries = chart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: {
                  type: 'volume',
                },
                priceScaleId: '', 
                scaleMargins: {
                  top: 0.85, 
                  bottom: 0,
                },
              });
              
              const volData = rawData.map(d => ({
                time: Math.floor(d.time),
                value: d.volume || 0,
                color: d.close >= d.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'
              }));
              
              volumeSeries.setData(volData);

              chart.timeScale().fitContent();

              // Crosshair move event
              chart.subscribeCrosshairMove((param) => {
                if (
                  param.point === undefined ||
                  !param.time ||
                  param.point.x < 0 ||
                  param.point.x > chartContainerRef.current.clientWidth ||
                  param.point.y < 0 ||
                  param.point.y > chartContainerRef.current.clientHeight
                ) {
                  // Fallback to last candle if out of bounds
                  const last = rawData[rawData.length - 1];
                  setCrosshairData({
                    time: last.time,
                    open: last.open,
                    high: last.high,
                    low: last.low,
                    close: last.close,
                    volume: last.volume || 0
                  });
                } else {
                  const dataPoint = param.seriesData.get(mainSeries);
                  const volPoint = param.seriesData.get(volumeSeries);
                  
                  if (dataPoint) {
                    setCrosshairData({
                      time: param.time,
                      open: dataPoint.open !== undefined ? dataPoint.open : dataPoint.value,
                      high: dataPoint.high !== undefined ? dataPoint.high : dataPoint.value,
                      low: dataPoint.low !== undefined ? dataPoint.low : dataPoint.value,
                      close: dataPoint.close !== undefined ? dataPoint.close : dataPoint.value,
                      volume: volPoint ? volPoint.value : 0
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
              
              // Slight delay to ensure parent has laid out completely
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
  }, [itemName, granularity, chartType]);

  // UI Helpers
  const formatNum = (num, decimals = 4) => {
    if (num === undefined || num === null) return '0.0000';
    return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
    <div className="w-full h-full flex flex-col bg-[#161a25] rounded-xl overflow-hidden shadow-2xl relative z-10 border border-slate-700/50">
      {/* Top Header - TradingView Style */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between p-3 border-b border-slate-700/50 bg-[#1e222d] gap-3">
        {/* Left: Asset Info */}
        <div className="flex items-center justify-between xl:justify-start w-full xl:w-auto gap-4">
          <div className="flex items-center gap-3">
            <img src={getAssetUrl(itemName)} className="w-8 h-8 object-contain drop-shadow-md" onError={(e) => { e.target.style.display = 'none'; }} />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 leading-none">{itemName}</h2>
                <button
                  onClick={onToggleTrack}
                  className="text-slate-400 hover:text-amber-400 transition-colors"
                  title={isTracked ? "Bỏ theo dõi" : "Thêm vào danh sách theo dõi"}
                >
                  <svg className={`w-4 h-4 ${isTracked ? 'text-amber-400 fill-amber-400' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </button>
              </div>
              <span className="text-[10px] text-slate-500 font-medium mt-0.5">Resource Market</span>
            </div>
          </div>
          {/* Close button on mobile */}
          <button 
            onClick={onClose}
            className="xl:hidden text-slate-500 hover:text-rose-400 p-1 rounded-md bg-slate-800/50"
          >
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

        {/* Right: Close (Desktop) */}
        <button 
          onClick={onClose}
          className="hidden xl:flex text-slate-500 hover:text-rose-400 hover:bg-slate-700/50 p-1.5 rounded-lg transition-colors"
          title="Đóng"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161a25] border-b border-slate-700/30">
        <div className="flex items-center gap-2 bg-slate-800/50 p-0.5 rounded-md border border-slate-700/50">
          <button
            onClick={() => setChartType('candle')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${chartType === 'candle' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="5" width="4" height="14" rx="1"></rect><rect x="13" y="3" width="4" height="12" rx="1"></rect><line x1="9" y1="2" x2="9" y2="5"></line><line x1="9" y1="19" x2="9" y2="22"></line><line x1="15" y1="2" x2="15" y2="3"></line><line x1="15" y1="15" x2="15" y2="22"></line></svg>
            <span className="hidden sm:inline">Nến</span>
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold transition-colors ${chartType === 'line' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            <span className="hidden sm:inline">Line</span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold text-slate-500 uppercase mr-1 hidden sm:inline">Khung giờ:</span>
          {['15m', '1h', '4h', '1d'].map(tf => (
            <button
              key={tf}
              onClick={() => setGranularity(tf)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${granularity === tf ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800'}`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
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
                Chưa có dữ liệu lịch sử cho khung giờ {granularity}.
             </div>
          </div>
        )}

        {/* Floating OHLCV Legend */}
        {crosshairData && chartType === 'candle' && (
          <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 bg-[#1e222d]/80 border border-slate-700/50 rounded-lg p-2 px-3 text-xs font-mono shadow-lg backdrop-blur-md pointer-events-none transition-opacity duration-150">
            <div className="text-slate-300 font-sans font-semibold mb-1 border-b border-slate-600/50 pb-1">{formatDate(crosshairData.time)}</div>
            <div className="flex gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">O</span>
                  <span className={getCrosshairColor(crosshairData.open, crosshairData.close)}>{formatNum(crosshairData.open)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">L</span>
                  <span className={getCrosshairColor(crosshairData.open, crosshairData.close)}>{formatNum(crosshairData.low)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">H</span>
                  <span className={getCrosshairColor(crosshairData.open, crosshairData.close)}>{formatNum(crosshairData.high)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">C</span>
                  <span className={getCrosshairColor(crosshairData.open, crosshairData.close)}>{formatNum(crosshairData.close)}</span>
                </div>
              </div>
            </div>
            {crosshairData.volume > 0 && (
              <div className="flex justify-between gap-3 mt-1 pt-1 border-t border-slate-600/50">
                <span className="text-slate-500">Vol</span>
                <span className="text-blue-400">{formatVol(crosshairData.volume)}</span>
              </div>
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
