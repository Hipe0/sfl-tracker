import React, { useEffect, useRef, useState } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { useFarm } from '../context/FarmContext';
import { getAssetUrl } from '../utils/gameConstants';

const MarketCandlestickChart = ({ itemName, onClose, isTracked, onToggleTrack, currentPrice }) => {
  const chartContainerRef = useRef(null);
  const { farmData } = useFarm();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);
  
  const [chartType, setChartType] = useState('line'); // force 'line'
  const [timeRange, setTimeRange] = useState('24H'); // '24H', '7D', '1M', '3M'
  const [showSold, setShowSold] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const granularityMap = { '24H': '1h', '7D': '4h', '1M': '1d', '3M': '3d' };
  const currentGranularity = granularityMap[timeRange] || '1h';
  
  const [crosshairData, setCrosshairData] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
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
    let soldSeries;

    const fetchAndRender = async () => {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        
        const limitMap = { '24H': 25, '7D': 42, '1M': 30, '3M': 30 };
        const limit = limitMap[timeRange] || 25;
        
        const res = await fetch(`${apiUrl}/api/market/history/${encodeURIComponent(itemName)}?granularity=${currentGranularity}&limit=${limit}`);
        const json = await res.json();
        
        if (json.success && json.data) {
          let rawData = json.data;
          
          // Filter out future dates from corrupted DB imports
          const nowSeconds = Math.floor(Date.now() / 1000);
          rawData = rawData.filter(d => d.time <= nowSeconds + 300); // allow 5 mins skew
          
          // Forward fill missing supply and volume to fix scraped data gaps
          let lastValidSupply = 0;
          let lastValidVolume = 0;
          for (let i = 0; i < rawData.length; i++) {
            if (rawData[i].supply > 0) lastValidSupply = rawData[i].supply;
            else rawData[i].supply = lastValidSupply;
            
            if (rawData[i].volume > 0) lastValidVolume = rawData[i].volume;
            else rawData[i].volume = lastValidVolume;
          }
          
          // Calculate 'sold' (Daily Traded) and 'volume' (Volume SFL) as deltas
          for (let i = rawData.length - 1; i >= 0; i--) {
            if (i === 0) {
              rawData[i].sold = 0; // First element has no previous delta
              rawData[i].cumulativeVolume = rawData[i].volume;
              rawData[i].volume = 0; // Set first volume delta to 0 to prevent spike
            } else {
              let diffSold = rawData[i].supply - rawData[i - 1].supply;
              rawData[i].sold = diffSold > 0 ? diffSold : 0;
              
              let diffVol = rawData[i].volume - rawData[i - 1].volume;
              rawData[i].cumulativeVolume = rawData[i].volume;
              rawData[i].volume = diffVol > 0 ? diffVol : 0;
            }
          }
          
          // Inject live point to make it up-to-date with current game state
          if (currentPrice > 0 && farmData && rawData.length > 0) {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const liveListings = farmData.marketListings?.[itemName] || 0;
            const liveTraded = farmData.marketTraded?.[itemName] || 0;
            const lastCandle = rawData[rawData.length - 1];
            
             // If the live data is significantly newer than the last recorded candle
            if (currentTimestamp > lastCandle.time + 60) {
               const soldDelta = Math.max(0, liveTraded - lastCandle.supply);
               const volumeDelta = Math.max(0, (farmData.marketVolume?.[itemName] || 0) - (lastCandle.cumulativeVolume || 0));
               rawData.push({
                 time: currentTimestamp,
                 open: lastCandle.close,
                 high: Math.max(lastCandle.close, currentPrice),
                 low: Math.min(lastCandle.close, currentPrice),
                 close: currentPrice,
                 volume: volumeDelta, 
                 cumulativeVolume: farmData.marketVolume?.[itemName] || 0,
                 supply: liveTraded,
                 listings: liveListings,
                 sold: soldDelta,
                 originalTime: currentTimestamp
               });
            }
          }
          
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
              sold: lastCandle.sold || 0,
              listings: lastCandle.listings || 0
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
                handleScroll: false,
                handleScale: false,
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
                localization: {
                  timeFormatter: (businessDayOrTimestamp) => {
                    if (!businessDayOrTimestamp) return '';
                    const d = new Date(businessDayOrTimestamp * 1000);
                    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
                  },
                },
                rightPriceScale: {
                  borderColor: 'rgba(51, 65, 85, 0.8)',
                  autoScale: true,
                },
                leftPriceScale: {
                  visible: showSold,
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
              
              // Apply timezone offset to trick Lightweight Charts into displaying Local Time on the X-axis natively
              const tzOffset = new Date().getTimezoneOffset() * 60;
              
              mainSeries.setData(rawData.map(d => ({
                time: Math.floor(d.time) - tzOffset,
                open: d.open, high: d.high, low: d.low, close: d.close, value: d.close,
                originalTime: d.time
              })));
              
              if (showSold) {
                soldSeries = chart.addLineSeries({
                  color: '#b39ddb',
                  priceScaleId: 'left',
                  lineWidth: 2,
                });
                soldSeries.setData(rawData.map(d => ({
                  time: Math.floor(d.time) - tzOffset,
                  value: d.sold || 0
                })));
              }
              
              volumeSeries = chart.addHistogramSeries({
                color: '#26a69a',
                priceFormat: { type: 'volume' },
                priceScaleId: 'vol', 
              });
              
              chart.priceScale('vol').applyOptions({
                scaleMargins: { top: 0.7, bottom: 0 },
                visible: false,
              });
              
              volumeSeries.setData(rawData.map(d => ({
                time: Math.floor(d.time) - tzOffset,
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
                    volume: last.volume || 0, sold: last.sold || 0, listings: last.listings || 0
                  });
                  setTooltipPos(null);
                } else {
                  const dataPoint = param.seriesData.get(mainSeries);
                  const volPoint = param.seriesData.get(volumeSeries);
                  const soldPoint = soldSeries ? param.seriesData.get(soldSeries) : null;
                  
                  if (dataPoint) {
                    const originalTime = dataPoint.originalTime || param.time + tzOffset;
                    setCrosshairData({
                      time: originalTime,
                      open: dataPoint.open !== undefined ? dataPoint.open : dataPoint.value,
                      high: dataPoint.high !== undefined ? dataPoint.high : dataPoint.value,
                      low: dataPoint.low !== undefined ? dataPoint.low : dataPoint.value,
                      close: dataPoint.close !== undefined ? dataPoint.close : dataPoint.value,
                      volume: volPoint ? volPoint.value : 0,
                      sold: soldPoint ? soldPoint.value : 0,
                      listings: dataPoint.listings !== undefined ? dataPoint.listings : (rawData.find(d => d.time === originalTime)?.listings || 0)
                    });
                    
                    // Update tooltip position
                    setTooltipPos({
                      x: param.point.x,
                      y: param.point.y
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
  }, [itemName, timeRange, chartType, showSold, isFullscreen]);

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
              <span className="text-[10px] text-slate-500 font-medium mt-0.5">ID: {itemName} - Nến {currentGranularity}</span>
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
            {farmData && farmData.marketTraded && farmData.marketTraded[itemName] !== undefined && (
              <div className="flex flex-col hidden sm:flex">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Traded</span>
                <span className="text-sm font-bold text-[#b39ddb]">{formatVol(farmData.marketTraded[itemName])}</span>
              </div>
            )}
            {farmData && farmData.marketListings && farmData.marketListings[itemName] !== undefined && (
              <div className="flex flex-col hidden sm:flex">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Listings</span>
                <span className="text-sm font-bold text-purple-400">{farmData.marketListings[itemName]}</span>
              </div>
            )}
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
          <label className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-700/50 p-1 rounded transition-colors text-xs">
            <input type="checkbox" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} className="rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500" />
            <span className="text-[#b39ddb] font-medium">Sold</span>
          </label>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {['24H', '7D', '1M', '3M'].map(tr => (
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
      <div className="relative flex-1 w-full min-h-[500px]">
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

        {/* Floating Tooltip */}
        {tooltipPos && crosshairData && (
          <div 
            className="absolute z-50 bg-[#1e222d] border border-slate-700 rounded shadow-lg p-2.5 text-xs font-mono text-slate-300 pointer-events-none"
            style={{
              left: Math.min(tooltipPos.x + 15, (chartContainerRef.current?.clientWidth || 500) - 180),
              top: Math.min(tooltipPos.y + 15, (chartContainerRef.current?.clientHeight || 300) - 100),
              minWidth: '160px'
            }}
          >
            <div className="font-bold text-white mb-2 pb-1 border-b border-slate-600">
              {formatDate(crosshairData.time)}
            </div>
            {crosshairData.sold > 0 && showSold && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2.5 h-2.5 bg-[#b39ddb]"></div>
                <span>{itemName} sold: <span className="text-white font-medium">{formatVol(crosshairData.sold)}</span></span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-2.5 h-2.5 bg-emerald-500"></div>
              <span>{itemName} price: <span className="text-white font-medium">{formatNum(crosshairData.close)}</span></span>
            </div>
            {crosshairData.volume > 0 && (
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-2.5 h-2.5 bg-[#26a69a]"></div>
                <span>Volume SFL: <span className="text-white font-medium">{formatVol(crosshairData.volume)}</span></span>
              </div>
            )}
            {crosshairData.listings > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 bg-orange-400"></div>
                <span>Listings: <span className="text-white font-medium">{crosshairData.listings}</span></span>
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
