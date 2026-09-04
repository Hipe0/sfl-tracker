import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFarm } from '../context/FarmContext';
import idMap from '../data/idMap.json';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { calculateTradeTax, isTradeResource } from '../utils/taxCalculator';
import { ASSET_URLS, getAssetUrl } from '../utils/gameConstants';

export default function MarketTradesPanel() {
  const { currentId, farmData } = useFarm();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [daysFilter, setDaysFilter] = useState(7);
  const [category, setCategory] = useState('all'); // 'all' | 'resource' | 'nft' // 7, 30, or 'all'
  const [tableTab, setTableTab] = useState('all'); // 'all' | 'buy' | 'sell' | 'group'

  const fetchTrades = useCallback(async () => {
    if (!currentId) return;
    try {
      setLoading(true);
      setError(null);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/farm/${currentId}/trades?days=${daysFilter}`);
      if (!res.ok) throw new Error(`Lỗi kết nối: ${res.status}`);
      const data = await res.json();
      
      if (data.success && data.data && data.data.trades) {
        setTrades(data.data.trades);
      } else {
        setTrades([]);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentId, daysFilter]);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  useEffect(() => {
    if (currentId !== '6279470157500012' && tableTab === 'group') {
      setTableTab('all');
    }
  }, [currentId, tableTab]);

  // Xử lý dữ liệu
  const { chartData, tableData, stats, pieBuyData, pieSellData, volumeData } = useMemo(() => {
    if (!trades || trades.length === 0) {
      return { chartData: [], tableData: [], stats: { pnl: 0, buy: 0, sell: 0 }, pieBuyData: [], pieSellData: [], volumeData: [] };
    }
    
    // Sort oldest to newest for charts
    const sortedTrades = [...trades].sort((a, b) => (a.fulfilledAt || 0) - (b.fulfilledAt || 0));
    
    // Lọc theo Category (All / Resource / NFT)
    const filteredTrades = sortedTrades.filter(trade => {
      if (category === 'all') return true;
      const mapKey = `${trade.collection}-${trade.itemId}`;
      const itemName = idMap[mapKey] || `Item #${trade.itemId}`;
      const isRes = isTradeResource(itemName);
      if (category === 'resource') return isRes;
      if (category === 'nft') return !isRes;
      return true;
    });
    
    let cumulativeSFL = 0;
    let totalBuy = 0;
    let totalSell = 0;
    
    const cData = [];
    const tData = [];
    
    // Group by item for pie chart (Buy)
    const itemBuyStats = {};
    // Group by item for pie chart (Sell)
    const itemSellStats = {};
    // Group by day for volume chart
    const dailyVol = {};

    filteredTrades.forEach(trade => {
      let isBuyer = false;
      let isSeller = false;
      const cid = Number(currentId);
      
      if (trade.source === 'offer') {
        if (trade.initiatedBy?.id === cid) isBuyer = true;
        if (trade.fulfilledBy?.id === cid) isSeller = true;
      } else if (trade.source === 'listing') {
        if (trade.initiatedBy?.id === cid) isSeller = true;
        if (trade.fulfilledBy?.id === cid) isBuyer = true;
      }
      
      let sflAmount = trade.sfl || 0;
      let type = isSeller ? 'sell' : (isBuyer ? 'buy' : 'unknown');
      
      // Extract item mapping
      const mapKey = `${trade.collection}-${trade.itemId}`;
      const itemName = idMap[mapKey] || `Item #${trade.itemId}`;
      const itemsStr = `${trade.quantity || 1} ${itemName}`;

      // Áp dụng thuế động dựa trên itemName và thông tin Đảo, VIP của người chơi
      let taxRate = calculateTradeTax(itemName, farmData);
      let netSflAmount = type === 'sell' ? sflAmount * (1 - taxRate) : sflAmount;
      let pnlChange = type === 'sell' ? netSflAmount : (type === 'buy' ? -sflAmount : 0);
      
      if (type === 'sell') totalSell += netSflAmount;
      if (type === 'buy') totalBuy += sflAmount;
      
      cumulativeSFL += pnlChange;

      // Date parsing
      const tradeDate = trade.fulfilledAt ? new Date(trade.fulfilledAt) : new Date();
      const dateStr = tradeDate.toLocaleString();
      const dayKey = tradeDate.toLocaleDateString();

      // Update Item Stats (Volume in SFL)
      if (type === 'buy') {
        if (!itemBuyStats[itemName]) itemBuyStats[itemName] = 0;
        itemBuyStats[itemName] += sflAmount;
      } else if (type === 'sell') {
        if (!itemSellStats[itemName]) itemSellStats[itemName] = 0;
        // Bán thì dùng netSflAmount hoặc sflAmount tuỳ bạn, ở đây dùng sflAmount gốc để xem giá trị giao dịch
        itemSellStats[itemName] += sflAmount;
      }
      
      // Update Daily Volume
      if (!dailyVol[dayKey]) dailyVol[dayKey] = { date: dayKey, buy: 0, sell: 0 };
      if (type === 'buy') dailyVol[dayKey].buy += sflAmount;
      if (type === 'sell') dailyVol[dayKey].sell += netSflAmount;

      cData.push({
        time: dateStr,
        timestamp: trade.fulfilledAt || Date.now(),
        pnl: Number(cumulativeSFL.toFixed(2)),
        amount: type === 'sell' ? netSflAmount : sflAmount,
        type,
        itemsStr
      });
      
      tData.push({
        id: trade.id || trade.tradeId || trade.signature || Math.random().toString(),
        time: dateStr,
        itemsStr,
        itemName,
        quantity: trade.quantity || 1,
        originalSflAmount: sflAmount,
        sflAmount: Number((type === 'sell' ? netSflAmount : sflAmount).toFixed(4)),
        type,
        pnlChange: Number(pnlChange.toFixed(4))
      });
    });

    // Prepare Pie Data (Top 10 items by volume) - Buy
    const sortedBuyPie = Object.entries(itemBuyStats)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
    
    const topBuyPie = sortedBuyPie.slice(0, 10);
    const otherBuyValue = sortedBuyPie.slice(10).reduce((sum, item) => sum + item.value, 0);
    if (otherBuyValue > 0) {
      topBuyPie.push({ name: 'Khác', value: Number(otherBuyValue.toFixed(2)) });
    }

    // Prepare Pie Data (Top 10 items by volume) - Sell
    const sortedSellPie = Object.entries(itemSellStats)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
    
    const topSellPie = sortedSellPie.slice(0, 10);
    const otherSellValue = sortedSellPie.slice(10).reduce((sum, item) => sum + item.value, 0);
    if (otherSellValue > 0) {
      topSellPie.push({ name: 'Khác', value: Number(otherSellValue.toFixed(2)) });
    }

    // Prepare Volume Data
    const volData = Object.values(dailyVol);

    // Bảng thì hiển thị mới nhất lên đầu
    tData.reverse();
    
    return { 
      chartData: cData, 
      tableData: tData, 
      stats: { pnl: cumulativeSFL, buy: totalBuy, sell: totalSell },
      pieBuyData: topBuyPie,
      pieSellData: topSellPie,
      volumeData: volData
    };
  }, [trades, currentId, farmData, category, daysFilter]);

  // Filtered/Grouped Table Data
  const displayedTableData = useMemo(() => {
    if (tableTab === 'buy') return tableData.filter(t => t.type === 'buy');
    if (tableTab === 'sell') return tableData.filter(t => t.type === 'sell');
    if (tableTab === 'group') {
      const grouped = {};
      tableData.forEach(t => {
        if (!grouped[t.itemName]) {
          grouped[t.itemName] = {
            itemName: t.itemName,
            buyQty: 0,
            sellQty: 0,
            buySfl: 0,
            sellSfl: 0,
            netSfl: 0,
          };
        }
        if (t.type === 'buy') {
           grouped[t.itemName].buyQty += t.quantity;
           grouped[t.itemName].buySfl += t.originalSflAmount;
           grouped[t.itemName].netSfl -= t.originalSflAmount;
        } else if (t.type === 'sell') {
           grouped[t.itemName].sellQty += t.quantity;
           grouped[t.itemName].sellSfl += t.sflAmount; // sflAmount is netSflAmount for sell
           grouped[t.itemName].netSfl += t.sflAmount;
        }
      });
      
      // Compute advanced trading metrics for each grouped item
      const enrichedGroups = Object.values(grouped).map(g => {
        const taxRate = calculateTradeTax(g.itemName, farmData);
        g.netQty = g.buyQty - g.sellQty;
        g.avgBuyPrice = g.buyQty > 0 ? (g.buySfl / g.buyQty) : 0;
        g.avgSellPrice = g.sellQty > 0 ? (g.sellSfl / g.sellQty) : 0;
        g.breakEvenPrice = g.avgBuyPrice > 0 ? (g.avgBuyPrice / (1 - taxRate)) : 0;
        
        // Floor price & Unrealized PnL calculation will be done in the render map 
        // to keep it dynamic and fresh, but we could do it here too.
        return g;
      });
      
      return enrichedGroups.sort((a, b) => b.netSfl - a.netSfl);
    }
    return tableData;
  }, [tableData, tableTab]);

  const activeTrades = useMemo(() => {
    if (!farmData?.gameData?.trades) return [];
    
    const listings = Object.entries(farmData.gameData.trades.listings || {}).map(([id, trade]) => {
      const items = trade.items || {};
      const itemName = Object.keys(items)[0];
      const itemAmount = items[itemName];
      return { id, type: 'sell', itemName, itemAmount, sfl: trade.sfl || 0, createdAt: trade.createdAt || 0 };
    });
    
    const offers = Object.entries(farmData.gameData.trades.offers || {}).map(([id, trade]) => {
      const items = trade.items || {};
      const itemName = Object.keys(items)[0];
      const itemAmount = items[itemName];
      return { id, type: 'buy', itemName, itemAmount, sfl: trade.sfl || 0, createdAt: trade.createdAt || 0 };
    });
    
    return [...listings, ...offers]
      .filter(trade => {
        if (category === 'all') return true;
        const isRes = isTradeResource(trade.itemName);
        if (category === 'resource') return isRes;
        if (category === 'nft') return !isRes;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [farmData, category]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

  if (!currentId) return <div className="text-gray-400 p-4">Vui lòng nhập Farm ID...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 backdrop-blur-xl bg-slate-900/50 border border-slate-700/50 p-4 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            Lịch Sử Giao Dịch Chợ
          </h2>
          <p className="text-sm text-slate-400 mt-1">Phân tích giao dịch chợ của Farm #{currentId}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Category Filter */}
          <div className="flex bg-[#0f172a] rounded-lg p-1 border border-[#334155]">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'resource', label: 'Tài nguyên' },
              { id: 'nft', label: 'NFTs' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-300 ${
                  category === cat.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent hover:bg-[#1e293b]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Time Filter */}
          <div className="flex bg-[#0f172a] rounded-lg p-1 border border-[#334155]">
            {[7, 30, 'all'].map(days => (
              <button
                key={days}
                onClick={() => setDaysFilter(days)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-300 ${
                  daysFilter === days
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent hover:bg-[#1e293b]'
                }`}
              >
                {days === 'all' ? 'Tất cả' : `${days} Ngày`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="text-blue-400 animate-pulse text-center p-8 text-lg">Đang đồng bộ dữ liệu...</div>}
      {error && <div className="text-red-400 bg-red-900/20 border border-red-800 p-4 rounded-xl">{error}</div>}
      
      {!loading && !error && trades.length === 0 && (
        <div className="text-slate-400 text-center p-12 bg-slate-900/40 rounded-2xl border border-slate-800 backdrop-blur-md">
          <p className="text-lg">Không tìm thấy giao dịch nào trong khoảng thời gian này.</p>
        </div>
      )}

      {!loading && !error && trades.length > 0 && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-slate-600 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-16 h-16 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              </div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Tổng Net PnL</p>
              <div className={`text-3xl font-bold ${stats.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stats.pnl > 0 ? '+' : ''}{stats.pnl.toFixed(2)} SFL
              </div>
            </div>
            
            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-slate-600 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-16 h-16 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              </div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Tổng Mua (Chi tiêu)</p>
              <div className="text-3xl font-bold text-rose-400">
                {stats.buy.toFixed(2)} SFL
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-slate-600 transition-colors">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <svg className="w-16 h-16 text-amber-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
              </div>
              <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">Tổng Bán (Thu nhập)</p>
              <div className="text-3xl font-bold text-emerald-400">
                {stats.sell.toFixed(2)} SFL
              </div>
            </div>
          </div>

          {/* Main Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Pie Charts */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              {/* Top Items Pie Chart (Buy) */}
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-lg flex flex-col flex-1 h-[250px]">
              <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                Top 10 Mua Vào (Chi Tiêu)
              </h3>
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieBuyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieBuyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '12px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${value} SFL`, 'Khối lượng']}
                    />
                    <Legend 
                      layout="horizontal" 
                      verticalAlign="bottom" 
                      align="center"
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
              {/* Top Items Pie Chart (Sell) */}
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-lg flex flex-col flex-1 h-[250px]">
              <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Top 10 Bán Ra (Thu Nhập)
              </h3>
              <div className="flex-1 min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieSellData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieSellData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '12px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                      formatter={(value) => [`${value} SFL`, 'Khối lượng']}
                    />
                    <Legend 
                      layout="horizontal" 
                      verticalAlign="bottom" 
                      align="center"
                      wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            </div>

            {/* Right Column: PnL & Volume Charts */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* PnL Area Chart */}
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-lg h-[250px] flex flex-col flex-1">
              <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Lợi Nhuận Ròng (Net PnL) Tích Luỹ
              </h3>
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorPnlNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} minTickGap={30} tickFormatter={(val) => val.split(' ')[0]} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  />
                  <ReferenceLine y={0} stroke="#475569" />
                  <Area 
                    type="monotone" 
                    dataKey="pnl" 
                    stroke="#10b981" 
                    fill="url(#colorPnl)" 
                    strokeWidth={3}
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              </div>

              {/* Volume Bar Chart */}
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 shadow-lg h-[250px] flex flex-col flex-1">
              <h3 className="text-slate-300 font-medium mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Khối Lượng Mua / Bán Theo Ngày
              </h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={volumeData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '12px' }}
                    cursor={{ fill: 'rgba(51, 65, 85, 0.4)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="buy" name="Mua (Tiêu SFL)" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="sell" name="Bán (Thu SFL)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Active Trades Table */}
          {activeTrades.length > 0 && (
            <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden shadow-lg mt-6 border-l-4 border-l-amber-500">
              <div className="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/50">
                <h3 className="text-amber-400 font-bold flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Đơn Đang Treo (Chưa Khớp)
                </h3>
                <span className="text-xs font-medium bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">
                  {activeTrades.length} đơn
                </span>
              </div>
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-400 bg-slate-800/80 sticky top-0 z-10 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-medium">Thời gian tạo</th>
                      <th className="px-6 py-4 font-medium">Loại Lệnh</th>
                      <th className="px-6 py-4 font-medium">Vật phẩm</th>
                      <th className="px-6 py-4 font-medium text-right">Giá trị (SFL)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {activeTrades.map((trade) => (
                      <tr key={trade.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                          {new Date(trade.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {trade.type === 'buy' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                              MUA CHỜ KHỚP
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                              BÁN CHỜ KHỚP
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-200 font-medium">{trade.itemAmount}</span>
                            <span className="text-slate-400">{trade.itemName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-300">
                          {trade.sfl.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden shadow-lg mt-6">
            <div className="p-5 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-slate-200 font-bold flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Chi Tiết Giao Dịch
              </h3>
              <div className="flex bg-slate-800/80 p-1 rounded-lg border border-slate-700 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                <button onClick={() => setTableTab('all')} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${tableTab === 'all' ? 'bg-blue-500/20 text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'}`}>Tất cả</button>
                <button onClick={() => setTableTab('buy')} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${tableTab === 'buy' ? 'bg-rose-500/20 text-rose-400 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'}`}>Mua vào</button>
                <button onClick={() => setTableTab('sell')} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${tableTab === 'sell' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'}`}>Bán ra</button>
                {currentId === '6279470157500012' && (
                  <button onClick={() => setTableTab('group')} className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${tableTab === 'group' ? 'bg-purple-500/20 text-purple-400 shadow-sm' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'}`}>Gom theo mặt hàng</button>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 bg-slate-800/80 sticky top-0 z-10 uppercase tracking-wider">
                  {tableTab === 'group' ? (
                    <tr>
                      <th className="px-6 py-4 font-medium">Vật phẩm</th>
                      <th className="px-6 py-4 font-medium text-right">Khối lượng</th>
                      <th className="px-6 py-4 font-medium text-right">Vị thế Mua</th>
                      <th className="px-6 py-4 font-medium text-right">Mục tiêu Xả</th>
                      <th className="px-6 py-4 font-medium text-right">Hiệu Suất</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-6 py-4 font-medium">Thời gian</th>
                      <th className="px-6 py-4 font-medium">Loại Lệnh</th>
                      <th className="px-6 py-4 font-medium">Vật phẩm</th>
                      <th className="px-6 py-4 font-medium text-right">Đơn giá</th>
                      <th className="px-6 py-4 font-medium text-right">Live Floor</th>
                      <th className="px-6 py-4 font-medium text-right">Tổng SFL</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {tableTab === 'group' ? (
                    displayedTableData.map((g, idx) => {
                      const liveFloor = farmData?.prices?.[g.itemName] || farmData?.marketStats?.nftPrices?.[g.itemName] || 0;
                      const taxRate = calculateTradeTax(g.itemName, farmData);
                      const currentReceive = liveFloor * (1 - taxRate);
                      const unrealizedPnL = g.netQty > 0 && liveFloor > 0 
                        ? (g.netQty * currentReceive) - (g.netQty * g.avgBuyPrice)
                        : 0;
                      const hasStock = g.netQty > 0;
                      // Maximum listing price is 125% of current floor
                      const maxListPrice = liveFloor > 0 ? liveFloor * 1.25 : 0;

                      return (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors duration-150">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={getAssetUrl(g.itemName)} className="w-8 h-8 object-contain drop-shadow-sm bg-slate-800 rounded-md p-1" onError={(e) => { e.target.style.display = 'none'; }} />
                            <div>
                              <div className="font-bold text-slate-200">{g.itemName}</div>
                              {hasStock ? (
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider">Đang giữ hàng</span>
                              ) : (
                                <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider">Không tồn dư</span>
                              )}
                            </div>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          <div className="font-mono text-sm">
                            <span className="text-slate-400 text-xs mr-2">Tồn:</span>
                            <span className={hasStock ? "text-blue-400 font-bold" : "text-slate-500"}>{g.netQty}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 font-mono">
                            Mua: {g.buyQty} | Bán: {g.sellQty}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 text-right">
                          <div className="font-mono text-sm text-slate-300">
                            <span className="text-slate-400 text-xs mr-2">Mua TB:</span>
                            {g.avgBuyPrice > 0 ? g.avgBuyPrice.toFixed(4) : '-'}
                          </div>
                          <div className="text-[11px] text-rose-400/80 mt-1 font-mono">
                            Tổng chi: -{g.buySfl.toFixed(4)}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="font-mono text-sm">
                            <span className="text-slate-400 text-xs mr-2">Hòa vốn:</span>
                            <span className="text-orange-400 font-medium">
                              {g.breakEvenPrice > 0 ? g.breakEvenPrice.toFixed(4) : '-'}
                            </span>
                          </div>
                          <div className="text-[11px] mt-1 font-mono flex items-center justify-end gap-1">
                            <span className="text-slate-500">Giá Sàn:</span>
                            <span className="text-slate-300">{liveFloor > 0 ? liveFloor.toFixed(4) : '?'}</span>
                            {g.breakEvenPrice > 0 && liveFloor > 0 && (
                              <span className={liveFloor >= g.breakEvenPrice ? "text-emerald-400" : "text-rose-400"}>
                                ({(((liveFloor - g.breakEvenPrice)/g.breakEvenPrice)*100).toFixed(1)}%)
                              </span>
                            )}
                          </div>
                          {hasStock && g.breakEvenPrice > maxListPrice && maxListPrice > 0 && (
                            <div className="text-[10px] text-rose-500 mt-1 uppercase font-semibold text-right flex items-center justify-end gap-1" title={`Max allowed list price is ${maxListPrice.toFixed(4)}`}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              Vượt Max List (+25%)
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {hasStock ? (
                            <div>
                              <div className={`font-bold font-mono text-sm ${unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {unrealizedPnL > 0 ? '+' : ''}{unrealizedPnL.toFixed(4)} SFL
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wider">
                                (Tạm tính nếu xả)
                              </div>
                            </div>
                          ) : (
                            <div className="text-slate-500 font-mono text-sm">-</div>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  ) : (
                    displayedTableData.map((t) => {
                      const unitPrice = t.originalSflAmount / (t.quantity || 1);
                      const floorPrice = farmData?.prices?.[t.itemName] || farmData?.marketStats?.nftPrices?.[t.itemName] || 0;
                      
                      let diffPercent = 0;
                      let isGood = false;
                      let diffText = '';

                      if (floorPrice > 0) {
                        if (t.type === 'buy') {
                          diffPercent = ((floorPrice - unitPrice) / unitPrice) * 100;
                          isGood = diffPercent >= 0;
                          diffText = isGood ? 'Rẻ hơn sàn hiện tại' : 'Đắt hơn sàn hiện tại';
                          diffText += `\nGiá sàn: ${floorPrice.toFixed(4)}\nGiá mua: ${unitPrice.toFixed(4)}`;
                        } else if (t.type === 'sell') {
                          const taxRate = calculateTradeTax(t.itemName, farmData);
                          const currentReceive = floorPrice * (1 - taxRate);
                          diffPercent = ((unitPrice - currentReceive) / currentReceive) * 100;
                          isGood = diffPercent >= 0;
                          diffText = isGood ? 'Bán được giá' : 'Bán hớ';
                          diffText += `\nThuế: ${(taxRate * 100).toFixed(1)}%\nThực nhận (nếu xả sàn): ${currentReceive.toFixed(4)}\nGiá bán: ${unitPrice.toFixed(4)}`;
                        }
                      }

                      return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors duration-150">
                        <td className="px-6 py-4 text-slate-300 whitespace-nowrap">{t.time}</td>
                        <td className="px-6 py-4">
                          {t.type === 'buy' && (
                            <span className="inline-flex items-center gap-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-md text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                              MUA
                            </span>
                          )}
                          {t.type === 'sell' && (
                            <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-xs font-semibold">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                              BÁN
                            </span>
                          )}
                          {t.type === 'unknown' && (
                            <span className="bg-slate-700/50 text-slate-300 border border-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold">KHÁC</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <img src={getAssetUrl(t.itemName)} className="w-5 h-5 object-contain drop-shadow-sm" onError={(e) => { e.target.style.display = 'none'; }} />
                            {t.itemsStr}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-slate-300">
                          {unitPrice > 0 ? unitPrice.toFixed(4) : '0.0000'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {floorPrice > 0 ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono text-amber-400">{floorPrice.toFixed(4)}</span>
                              {t.type !== 'unknown' && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${isGood ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`} title={diffText}>
                                  {isGood ? '▲' : '▼'} {Math.abs(diffPercent).toFixed(1)}%
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic text-xs">N/A</span>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-right font-bold font-mono ${t.type === 'buy' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {t.type === 'buy' ? '-' : '+'}{t.sflAmount}
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
