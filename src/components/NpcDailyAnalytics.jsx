import React, { useState, useEffect, useMemo } from 'react';

const NpcDailyAnalytics = ({ farmId, refreshKey, globalConfig }) => {
  const [history, setHistory] = useState({ deliveries: {} });
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  const [expandedDates, setExpandedDates] = useState({});

  const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/farm/${farmId}/history?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.data || { deliveries: {} });
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoadingHistory(false);
      }
  };

  useEffect(() => {
    if (farmId) {
      fetchHistory();
    }
  }, [farmId, refreshKey]);

  const coinRate = parseFloat(globalConfig?.coinRate?.replace(/,/g, '') || '1388');

  // Process data
  const { sortedDates, processedData } = useMemo(() => {
    if (!history.deliveries) return { sortedDates: [], processedData: {} };

    const dates = Object.keys(history.deliveries).sort((a, b) => new Date(b) - new Date(a));
    const processed = {};

    dates.forEach(dateStr => {
      const dayDeliveries = history.deliveries[dateStr] || [];
      const coinNpcMap = {};
      const sflNpcMap = {};
      const ticketNpcMap = {};

      dayDeliveries.forEach(d => {
        let npcName = d.npcName || 'Unknown';
        npcName = npcName.charAt(0).toUpperCase() + npcName.slice(1);
        
        const isCoin = d.rewardType === 'Coins' || d.rewardType === 'coins';
        const isSfl = d.rewardType === 'SFL' || d.rewardType === 'sfl';
        const isTicket = !isCoin && !isSfl && d.rewardType && d.rewardType !== 'Unknown';
        
        let targetMap;
        if (d.status === 'skipped') {
           const coinNpcs = ['betty', 'blacksmith', 'pumpkin pete', 'raven', 'bert', 'corale', 'cornwell', 'timmy', 'tywin', 'victoria'];
           const ticketNpcs = ['garth', 'old salty', 'tango', 'miranda', 'pharaoh', 'finn', 'birdie', 'finley', 'jester', 'eldric'];
           if (coinNpcs.includes(npcName.toLowerCase())) targetMap = coinNpcMap;
           else if (ticketNpcs.includes(npcName.toLowerCase())) targetMap = ticketNpcMap;
           else targetMap = sflNpcMap;
        } else {
           if (!isCoin && !isSfl && !isTicket) return;
           targetMap = isCoin ? coinNpcMap : (isTicket ? ticketNpcMap : sflNpcMap);
        }
        
        if (!targetMap[npcName]) {
          targetMap[npcName] = { 
            name: npcName, count: 0, 
            reward: 0, costSfl: 0, skipCount: 0, tasks: [],
            rewardType: d.rewardType
          };
        }
        
        if (d.status === 'skipped') {
          targetMap[npcName].skipCount++;
          targetMap[npcName].tasks.push({ status: 'skipped', count: d.count, timestamp: d.timestamp || Date.now() });
        } else {
          targetMap[npcName].count++;
          targetMap[npcName].reward += parseFloat(d.reward || 0);
          targetMap[npcName].costSfl += parseFloat(d.totalP2PCost || 0);
          
          targetMap[npcName].tasks.push({ 
            status: 'success', 
            reward: parseFloat(d.reward || 0), 
            cost: parseFloat(d.totalP2PCost || 0),
            reqItems: d.reqItems || [],
            count: d.count,
            timestamp: d.timestamp || Date.now() 
          });
        }
      });

      // Calculate profit and format
      const processMap = (map, isCoin) => {
         return Object.values(map).map(npc => {
            const rewardSfl = isCoin ? npc.reward / coinRate : npc.reward;
            npc.profitSfl = rewardSfl - npc.costSfl;
            return npc;
         }).sort((a, b) => b.count - a.count);
      };

      processed[dateStr] = {
         coinNpcs: processMap(coinNpcMap, true),
         sflNpcs: processMap(sflNpcMap, false),
         ticketNpcs: Object.values(ticketNpcMap).map(npc => {
            npc.profitSfl = 0; // Tickets don't have SFL profit calculation yet
            return npc;
         }).sort((a, b) => b.count - a.count)
      };
    });

    return { sortedDates: dates, processedData: processed };
  }, [history, coinRate]);

  // Expand today by default
  useEffect(() => {
    if (sortedDates.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const defaultDate = sortedDates.includes(today) ? today : sortedDates[0];
      setExpandedDates({ [defaultDate]: true });
    }
  }, [sortedDates]);

  const toggleDate = (dateStr) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: !prev[dateStr]
    }));
  };

  if (loadingHistory && sortedDates.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <div className="bg-slate-800/60 rounded-2xl p-8 border border-slate-700/50 shadow-xl backdrop-blur-sm text-center">
        <h3 className="text-xl font-bold text-slate-300 mb-2">Chưa có dữ liệu</h3>
        <p className="text-slate-400">Bạn chưa có lịch sử giao hàng nào được ghi nhận.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-900/40 to-slate-800/40 rounded-2xl p-6 border border-emerald-500/20 shadow-xl backdrop-blur-sm flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <i className="bi bi-person-lines-fill text-emerald-400"></i>
            Thống Kê NPC Hằng Ngày
          </h2>
          <p className="text-slate-400 mt-1">Theo dõi số lần giao và doanh thu từ từng nhân vật mỗi ngày</p>
        </div>
      </div>

      <div className="space-y-4">
        {sortedDates.map(dateStr => {
          const { coinNpcs, sflNpcs, ticketNpcs } = processedData[dateStr];
          const isExpanded = expandedDates[dateStr];
          
          // Calculate daily totals
          const dailyCoinTotal = coinNpcs.reduce((acc, npc) => {
             acc.count += npc.count;
             acc.reward += npc.reward;
             acc.costSfl += npc.costSfl;
             acc.profitSfl += npc.profitSfl;
             return acc;
          }, { count: 0, reward: 0, costSfl: 0, profitSfl: 0 });
          
          const dailySflTotal = sflNpcs.reduce((acc, npc) => {
             acc.count += npc.count;
             acc.reward += npc.reward;
             acc.costSfl += npc.costSfl;
             acc.profitSfl += npc.profitSfl;
             return acc;
          }, { count: 0, reward: 0, costSfl: 0, profitSfl: 0 });
          
          const dailyTicketTotal = ticketNpcs.reduce((acc, npc) => {
             acc.count += npc.count;
             acc.reward += npc.reward;
             acc.costSfl += npc.costSfl;
             return acc;
          }, { count: 0, reward: 0, costSfl: 0 });
          
          const totalCount = dailyCoinTotal.count + dailySflTotal.count + dailyTicketTotal.count;
          const totalProfit = dailyCoinTotal.profitSfl + dailySflTotal.profitSfl; // Tickets have no SFL profit

          const renderNpcCard = (npc, type) => (
            <div key={npc.name} className="bg-slate-800 rounded-xl border border-slate-700/60 p-4 shadow-lg hover:border-slate-500/50 transition-colors relative overflow-hidden group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center shadow-inner overflow-hidden flex-shrink-0 relative group-hover:border-emerald-500/50 transition-colors">
                  <img 
                    src={`https://sfl.world/img/plaza/${encodeURIComponent(npc.name.toLowerCase())}.gif`} 
                    alt={npc.name}
                    className="w-full h-full object-contain scale-150 transform origin-top"
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src = `https://sfl.world/img/plaza/${encodeURIComponent(npc.name.toLowerCase())}.png`;
                      // Fallback if png also fails
                      setTimeout(() => {
                         if (!e.target.complete || e.target.naturalWidth === 0) {
                            e.target.outerHTML = '<i class="bi bi-person-fill text-2xl text-slate-500"></i>';
                         }
                      }, 500);
                    }}
                  />
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-[10px] font-black w-5 h-5 rounded-tl-lg flex items-center justify-center shadow-md">
                     {npc.count}
                  </div>
                </div>
                <div>
                  <h4 className="font-bold text-slate-200 text-base">{npc.name}</h4>
                  <p className="text-xs text-slate-400 font-medium">Hoàn thành: {npc.count} lần</p>
                </div>
              </div>
              
              {npc.tasks && npc.tasks.length > 0 && (
                <div className="space-y-1 mt-3 border-t border-slate-700/50 pt-3 mb-3">
                   <div className="text-[10px] uppercase text-slate-500 font-bold mb-1 px-1">Chi tiết giao hàng</div>
               {npc.tasks.map((task, idx) => (
                 <div key={idx} className="flex flex-col gap-1 text-xs px-2 py-1 bg-slate-900/30 rounded border border-slate-800/50">
                   <div className="flex justify-between items-start w-full">
                     <div className="flex flex-col mt-0.5">
                        <span className="text-slate-300 font-medium font-mono text-[11px] uppercase tracking-wider bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50" title="Mã đơn hàng">
                           {task.count ? `${npc.name.toUpperCase()}_${task.status === 'success' ? 'DONE' : 'SKIP'}_${task.count}` : `LẦN ${idx + 1}`}
                        </span>
                     </div>
                     {task.status === 'skipped' ? (
                        <span className="text-red-400/80 font-medium italic mt-0.5 text-xs">Skip</span>
                     ) : (
                        <span className="font-bold flex flex-col items-end">
                          <span className={type === 'coin' ? 'text-yellow-400' : type === 'ticket' ? 'text-purple-400' : 'text-blue-400'}>+{task.reward} {type === 'coin' ? '🪙' : type === 'ticket' ? '🎟️' : 'SFL'}</span>
                          <span className="text-slate-500 text-[10px]">- {task.cost.toFixed(4)} SFL</span>
                        </span>
                     )}
                   </div>
                   {task.reqItems && task.reqItems.length > 0 && task.status !== 'skipped' && (
                     <div className="flex flex-wrap gap-2 mt-1 pt-1 border-t border-slate-800/30">
                       {task.reqItems.map((req, i) => (
                          <div key={i} className="flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/50">
                             <div className="w-5 h-5 bg-slate-900/80 rounded flex items-center justify-center p-0.5 shadow-inner border border-slate-800">
                                <img src={req.img || `https://sfl.world/img/delivery/${req.name}.png`} 
                                     alt={req.name} className="max-w-full max-h-full object-contain drop-shadow-md"
                                     onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = `https://sfl.world/img/items/${encodeURIComponent(req.name.toLowerCase().replace(/ /g, '_'))}.png`;
                                     }} />
                             </div>
                             <span className="text-[10px] text-slate-300"><span className="text-slate-500">{req.total}x</span> {req.name}</span>
                          </div>
                       ))}
                     </div>
                   )}
                 </div>
               ))}
                </div>
              )}
              
              <div className="space-y-1.5 mt-2 border-t border-slate-700/50 pt-3">
                <div className="flex justify-between items-center bg-slate-900/50 px-2 py-1.5 rounded-lg border border-slate-700/50">
                   <span className="text-xs text-slate-400 font-medium">Tổng Nhận</span>
                   <span className={`text-sm font-black ${type === 'coin' ? 'text-yellow-400' : type === 'ticket' ? 'text-purple-400' : 'text-blue-400'}`}>
                     +{npc.reward.toFixed(type === 'sfl' ? 4 : 0)} {type === 'coin' ? '🪙' : type === 'ticket' ? '🎟️' : 'SFL'}
                   </span>
                </div>
                <div className="flex justify-between items-center bg-slate-900/50 px-2 py-1.5 rounded-lg border border-slate-700/50">
                   <span className="text-xs text-slate-400 font-medium">Tổng Chi</span>
                   <span className="text-sm font-black text-rose-400">
                     - {npc.costSfl.toFixed(4)} SFL
                   </span>
                </div>
                {type !== 'ticket' && (
                <div className="flex justify-between items-center bg-slate-900/50 px-2 py-1.5 rounded-lg border border-slate-700/50">
                   <span className="text-xs text-slate-400 font-medium">Lời / Lỗ</span>
                   <span className={`text-sm font-black ${npc.profitSfl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {npc.profitSfl >= 0 ? '+' : ''}{npc.profitSfl.toFixed(4)} SFL
                   </span>
                </div>
                )}
              </div>
            </div>
          );

          return (
            <div key={dateStr} className="bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden backdrop-blur-sm">
              <div 
                className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors flex flex-wrap justify-between items-center gap-4 border-b border-slate-700/50"
                onClick={() => toggleDate(dateStr)}
              >
                <div className="flex items-center gap-3">
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 flex items-center justify-center min-w-[50px]">
                    <span className="text-lg font-black text-emerald-400">{new Date(dateStr).getDate()}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{new Date(dateStr).toLocaleDateString('vi-VN', { weekday: 'long', month: 'long', year: 'numeric' })}</h3>
                    <p className="text-sm text-slate-400 font-medium">Tổng: {totalCount} Nhiệm vụ</p>
                  </div>
                </div>
                
                <div className="flex gap-2 items-center flex-wrap">
                  <span className="text-xs text-slate-400">Tổng Lời:</span>
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 shadow-sm ${totalProfit >= 0 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                     {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(4)} SFL
                  </span>
                  <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} text-slate-400 ml-2`}></i>
                </div>
              </div>
              
              {isExpanded && (
                <div className="p-5 bg-slate-900/30 flex flex-col gap-6">
                  
                  {/* Coin NPCs */}
                  {coinNpcs.length > 0 && (
                  <div>
                     <h4 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">🪙 NPC Trả Coins</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                       {coinNpcs.map(npc => renderNpcCard(npc, 'coin'))}
                     </div>
                     <div className="mt-4 flex flex-wrap gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 justify-end">
                        <div className="text-sm"><span className="text-slate-400">Tổng Nhận:</span> <span className="font-bold text-yellow-400">{dailyCoinTotal.reward.toFixed(0)} Coins</span></div>
                        <div className="text-sm"><span className="text-slate-400">Tổng Chi:</span> <span className="font-bold text-red-400">{dailyCoinTotal.costSfl.toFixed(4)} SFL</span></div>
                        <div className="text-sm flex items-center gap-2"><span className="text-slate-400">Tổng Lời:</span> <span className={`font-bold ${dailyCoinTotal.profitSfl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{dailyCoinTotal.profitSfl >= 0 ? '+' : ''}{dailyCoinTotal.profitSfl.toFixed(4)} SFL</span></div>
                     </div>
                  </div>
                  )}

                  {/* SFL NPCs */}
                  {sflNpcs.length > 0 && (
                  <div>
                     <h4 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2"><img src="https://sfl.world/img/sfl.webp" className="w-5 h-5"/> NPC Trả SFL</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                       {sflNpcs.map(npc => renderNpcCard(npc, 'sfl'))}
                     </div>
                     <div className="mt-4 flex flex-wrap gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 justify-end">
                        <div className="text-sm"><span className="text-slate-400">Tổng Nhận:</span> <span className="font-bold text-blue-400">{dailySflTotal.reward.toFixed(4)} SFL</span></div>
                        <div className="text-sm"><span className="text-slate-400">Tổng Chi:</span> <span className="font-bold text-red-400">{dailySflTotal.costSfl.toFixed(4)} SFL</span></div>
                        <div className="text-sm flex items-center gap-2"><span className="text-slate-400">Tổng Lời:</span> <span className={`font-bold ${dailySflTotal.profitSfl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{dailySflTotal.profitSfl >= 0 ? '+' : ''}{dailySflTotal.profitSfl.toFixed(4)} SFL</span></div>
                     </div>
                  </div>
                  )}

                  {/* Ticket NPCs */}
                  {ticketNpcs && ticketNpcs.length > 0 && (
                  <div>
                     <h4 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2">🎟️ NPC Trả Ticket</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                       {ticketNpcs.map(npc => renderNpcCard(npc, 'ticket'))}
                     </div>
                     <div className="mt-4 flex flex-wrap gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 justify-end">
                        <div className="text-sm"><span className="text-slate-400">Tổng Nhận:</span> <span className="font-bold text-purple-400">{dailyTicketTotal.reward.toFixed(0)} Tickets</span></div>
                        <div className="text-sm"><span className="text-slate-400">Tổng Chi:</span> <span className="font-bold text-red-400">{dailyTicketTotal.costSfl.toFixed(4)} SFL</span></div>
                     </div>
                  </div>
                  )}
                  
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NpcDailyAnalytics;
