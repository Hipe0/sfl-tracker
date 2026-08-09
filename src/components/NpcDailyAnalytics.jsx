import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFarm } from '../context/FarmContext';
import { formatCurrency } from '../utils/currencyUtils';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const NpcDailyAnalytics = () => {
  const { farmData, currentId: farmId, analyticsRefreshKey: refreshKey } = useFarm();
  const globalConfig = farmData?.globalConfig;
  const [history, setHistory] = useState({ deliveries: {} });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [viewMode, setViewMode] = useState('day'); // 'day', 'week', 'month', 'all_time'
  const [expandedGroups, setExpandedGroups] = useState({});

  const fetchHistory = useCallback(async () => {
      try {
        setLoadingHistory(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const token = localStorage.getItem('sfl_token');
        const res = await fetch(`${apiUrl}/api/farm/${farmId}/history?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setHistory(data.data || { deliveries: {} });
        }
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setLoadingHistory(false);
      }
  }, [farmId]);

  useEffect(() => {
    if (farmId) {
      fetchHistory();
    }
  }, [farmId, refreshKey, fetchHistory]);

  const coinRate = parseFloat(globalConfig?.coinRate?.replace(/,/g, '') || '1388');

  const getWeekStr = (dateStr) => {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  };

  const getMonthStr = (dateStr) => {
    return dateStr.substring(0, 7);
  };

  // Process data
  const { sortedGroups, processedData, allTimeData } = useMemo(() => {
    if (!history.deliveries) return { sortedGroups: [], processedData: {}, allTimeData: null };

    const groupedDeliveries = {};
    const allTimeCoinNpcs = {};
    const allTimeSflNpcs = {};
    const allTimeTicketNpcs = {};

    Object.keys(history.deliveries).forEach(dateStr => {
      // 1. Grouping for all_time
      const dayData = history.deliveries[dateStr];
      dayData.forEach(d => {
        let npcName = d.npcName || 'Unknown';
        npcName = npcName.charAt(0).toUpperCase() + npcName.slice(1);
        
        const isCoin = d.rewardType === 'Coins' || d.rewardType === 'coins';
        const isSfl = d.rewardType === 'SFL' || d.rewardType === 'sfl';
        const isTicket = !isCoin && !isSfl && d.rewardType && d.rewardType !== 'Unknown';
        
        let targetMap;
        if (d.status === 'skipped') {
           const coinNpcs = ['betty', 'blacksmith', 'pumpkin pete', 'bert', 'corale', 'cornwell', 'timmy', 'victoria'];
           const ticketNpcs = ['tywin', 'raven', 'garth', 'old salty', 'tango', 'miranda', 'pharaoh', 'finn', 'birdie', 'finley', 'jester', 'eldric'];
           if (coinNpcs.includes(npcName.toLowerCase())) targetMap = allTimeCoinNpcs;
           else if (ticketNpcs.includes(npcName.toLowerCase())) targetMap = allTimeTicketNpcs;
           else targetMap = allTimeSflNpcs;
        } else {
           if (!isCoin && !isSfl && !isTicket) return;
           targetMap = isCoin ? allTimeCoinNpcs : (isTicket ? allTimeTicketNpcs : allTimeSflNpcs);
        }
        
        if (!targetMap[npcName]) {
           targetMap[npcName] = { name: npcName, count: 0, reward: 0, costSfl: 0 };
        }
        if (d.status !== 'skipped') {
           targetMap[npcName].count++;
           targetMap[npcName].reward += parseFloat(d.reward || 0);
           targetMap[npcName].costSfl += parseFloat(d.totalP2PCost || 0);
        }
      });

      // 2. Grouping for Day/Week/Month
      if (viewMode !== 'all_time') {
        let groupKey;
        if (viewMode === 'day') {
          groupKey = dateStr;
        } else if (viewMode === 'week') {
          groupKey = getWeekStr(dateStr);
        } else if (viewMode === 'month') {
          groupKey = getMonthStr(dateStr);
        }

        if (!groupedDeliveries[groupKey]) groupedDeliveries[groupKey] = [];
        const enrichedDayData = dayData.map(d => ({ ...d, originalDate: dateStr }));
        groupedDeliveries[groupKey] = groupedDeliveries[groupKey].concat(enrichedDayData);
      }
    });

    const processAllTimeMap = (map, isCoin) => {
       return Object.values(map).map(npc => {
           const rewardSfl = isCoin ? npc.reward / coinRate : npc.reward;
           npc.profitSfl = rewardSfl - npc.costSfl;
           return npc;
       }).sort((a, b) => b.count - a.count);
    };

    const finalAllTimeData = {
       coinNpcs: processAllTimeMap(allTimeCoinNpcs, true),
       sflNpcs: processAllTimeMap(allTimeSflNpcs, false),
       ticketNpcs: Object.values(allTimeTicketNpcs).map(npc => {
           npc.profitSfl = 0;
           return npc;
       }).sort((a, b) => b.count - a.count)
    };

    const groups = Object.keys(groupedDeliveries).sort((a, b) => b.localeCompare(a));
    const processed = {};

    groups.forEach(groupStr => {
      const groupDeliveries = groupedDeliveries[groupStr] || [];
      const coinNpcMap = {};
      const sflNpcMap = {};
      const ticketNpcMap = {};

      groupDeliveries.forEach(d => {
        let npcName = d.npcName || 'Unknown';
        npcName = npcName.charAt(0).toUpperCase() + npcName.slice(1);
        
        const isCoin = d.rewardType === 'Coins' || d.rewardType === 'coins';
        const isSfl = d.rewardType === 'SFL' || d.rewardType === 'sfl';
        const isTicket = !isCoin && !isSfl && d.rewardType && d.rewardType !== 'Unknown';
        
        let targetMap;
        if (d.status === 'skipped') {
           const coinNpcs = ['betty', 'blacksmith', 'pumpkin pete', 'bert', 'corale', 'cornwell', 'timmy', 'victoria'];
           const ticketNpcs = ['tywin', 'raven', 'garth', 'old salty', 'tango', 'miranda', 'pharaoh', 'finn', 'birdie', 'finley', 'jester', 'eldric'];
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
          targetMap[npcName].tasks.push({ status: 'skipped', count: d.count, timestamp: d.timestamp || Date.now(), dateStr: d.originalDate });
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
            timestamp: d.timestamp || Date.now(),
            dateStr: d.originalDate
          });
        }
      });

      const processMap = (map, isCoin) => {
         return Object.values(map).map(npc => {
            const rewardSfl = isCoin ? npc.reward / coinRate : npc.reward;
            npc.profitSfl = rewardSfl - npc.costSfl;
            npc.tasks.sort((a, b) => b.timestamp - a.timestamp);
            return npc;
         }).sort((a, b) => b.count - a.count);
      };

      processed[groupStr] = {
         coinNpcs: processMap(coinNpcMap, true),
         sflNpcs: processMap(sflNpcMap, false),
         ticketNpcs: Object.values(ticketNpcMap).map(npc => {
            npc.profitSfl = 0; 
            npc.tasks.sort((a, b) => b.timestamp - a.timestamp);
            return npc;
         }).sort((a, b) => b.count - a.count)
      };
    });

    return { sortedGroups: groups, processedData: processed, allTimeData: finalAllTimeData };
  }, [history, coinRate, viewMode]);

  useEffect(() => {
    if (viewMode !== 'all_time' && sortedGroups.length > 0) {
      let defaultGroup;
      if (viewMode === 'day') {
         const today = new Date().toISOString().split('T')[0];
         defaultGroup = sortedGroups.includes(today) ? today : sortedGroups[0];
      } else {
         defaultGroup = sortedGroups[0];
      }
      setExpandedGroups({ [defaultGroup]: true });
    } else {
      setExpandedGroups({});
    }
  }, [sortedGroups, viewMode]);

  const toggleGroup = (groupStr) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupStr]: !prev[groupStr]
    }));
  };

  const formatGroupHeader = (groupStr) => {
    if (viewMode === 'day') {
      return new Date(groupStr).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } else if (viewMode === 'week') {
      const [year, weekStr] = groupStr.split('-W');
      return `Tuần ${weekStr}, Năm ${year}`;
    } else if (viewMode === 'month') {
      const [year, month] = groupStr.split('-');
      return `Tháng ${month}, Năm ${year}`;
    }
  };

  const formatGroupBadge = (groupStr) => {
    if (viewMode === 'day') return new Date(groupStr).getDate();
    if (viewMode === 'week') return groupStr.split('-W')[1];
    if (viewMode === 'month') return groupStr.split('-')[1];
  };

  if (loadingHistory && sortedGroups.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // ALL TIME RENDERING LOGIC
  const renderAllTimeCard = (npc, type) => {
     let avgStatText = '';
     let avgStatValue = '';
     let avgStatColor = '';

     if (type === 'coin' || type === 'sfl') {
        const profitPerSfl = npc.costSfl > 0 ? (npc.profitSfl / npc.costSfl) : (npc.profitSfl > 0 ? npc.profitSfl : 0);
        avgStatText = "Lời / 1 SFL phí";
        avgStatValue = npc.costSfl === 0 && npc.profitSfl > 0 ? "Vô hạn" : `${profitPerSfl >= 0 ? '+' : ''}${formatCurrency(profitPerSfl, 4)} SFL`;
        avgStatColor = profitPerSfl >= 0 ? 'text-emerald-400' : 'text-red-400';
     } else if (type === 'ticket') {
        const costPerTicket = npc.reward > 0 ? (npc.costSfl / npc.reward) : 0;
        avgStatText = "Phí / 1 Ticket";
        avgStatValue = `${formatCurrency(costPerTicket, 4)} SFL`;
        avgStatColor = 'text-rose-400';
     }

     return (
       <div key={npc.name} className="bg-slate-800 rounded-xl border border-slate-700/60 p-4 shadow-lg hover:border-slate-500/50 transition-colors relative overflow-hidden group">
         <div className="flex items-center gap-4 mb-4">
           <div className="w-16 h-16 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center shadow-inner overflow-hidden flex-shrink-0 relative group-hover:border-emerald-500/50 transition-colors">
             <img 
               src={`https://sfl.world/img/plaza/${encodeURIComponent(npc.name.toLowerCase())}.gif`} 
               alt={npc.name}
               className="w-full h-full object-contain scale-150 transform origin-top"
               onError={(e) => {
                 e.target.onerror = null; 
                 e.target.src = `https://sfl.world/img/plaza/${encodeURIComponent(npc.name.toLowerCase())}.png`;
               }}
             />
             <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-xs font-black px-1.5 py-0.5 rounded-tl-lg shadow-md">
                {npc.count}
             </div>
           </div>
           <div>
             <h4 className="font-bold text-white text-lg">{npc.name}</h4>
             <p className="text-sm text-slate-400 font-medium">Tổng giao: <span className="text-emerald-400 font-bold">{npc.count}</span> đơn</p>
           </div>
         </div>
         
         <div className="space-y-2 mt-4 bg-slate-900/40 p-3 rounded-lg border border-slate-700/50">
           <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Tổng Chi:</span>
              <span className="text-sm font-black text-rose-400">
                {npc.costSfl.toFixed(4)} SFL
              </span>
           </div>
           <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Tổng Nhận:</span>
              <span className={`text-sm font-black ${type === 'coin' ? 'text-yellow-400' : type === 'ticket' ? 'text-purple-400' : 'text-blue-400'}`}>
                {npc.reward.toFixed(type === 'sfl' ? 4 : 0)} {type === 'coin' ? <img src={COIN_IMG} className="w-4 h-4 inline-block align-text-bottom drop-shadow-sm" alt="Coins"/> : type === 'ticket' ? <img src="/shiny_feather.webp" className="w-4 h-4 inline-block align-text-bottom drop-shadow-sm" alt="Feather"/> : 'SFL'}
              </span>
           </div>
           {type !== 'ticket' && (
           <div className="flex justify-between items-center pt-2 border-t border-slate-700/50 mt-2">
              <span className="text-sm text-slate-400">Tổng Lời:</span>
              <span className={`text-sm font-black ${npc.profitSfl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {npc.profitSfl >= 0 ? '+' : ''}{npc.profitSfl.toFixed(4)} SFL
              </span>
           </div>
           )}
         </div>

         <div className="mt-3 bg-emerald-900/20 border border-emerald-500/20 p-2.5 rounded-lg flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{avgStatText}</span>
            <span className={`text-sm font-black ${avgStatColor}`}>
               {avgStatValue}
            </span>
         </div>
       </div>
     );
  };

  return (
    <div className="space-y-6 animate-fade-in-up mt-8 border-t-2 border-slate-700/50 pt-8">
      <div className="bg-gradient-to-r from-indigo-900/40 to-slate-800/40 rounded-2xl p-6 border border-indigo-500/20 shadow-xl backdrop-blur-sm flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-black text-white flex items-center gap-3">
            <i className="bi bi-bar-chart-fill text-indigo-400"></i>
            📊 Lịch Sử Thân Thiết (Friendship & ROI)
          </h2>
          <p className="text-slate-400 mt-1">Theo dõi số lượng giao hàng, chi tiêu và lời lỗ trên từng NPC.</p>
        </div>
        
        {/* Tabs */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/50 shadow-inner flex-wrap gap-1">
          <button 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${viewMode === 'day' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            onClick={() => setViewMode('day')}
          >
            Hằng Ngày
          </button>
          <button 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${viewMode === 'week' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            onClick={() => setViewMode('week')}
          >
            Hằng Tuần
          </button>
          <button 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${viewMode === 'month' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
            onClick={() => setViewMode('month')}
          >
            Hằng Tháng
          </button>
          <div className="w-px h-6 bg-slate-700 mx-1 hidden sm:block"></div>
          <button 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 flex items-center gap-2 ${viewMode === 'all_time' ? 'bg-indigo-500 text-white shadow-md border border-indigo-400' : 'text-indigo-400 hover:text-indigo-300 hover:bg-slate-800'}`}
            onClick={() => setViewMode('all_time')}
          >
            <i className="bi bi-bar-chart-fill"></i> Tổng Quan
          </button>
        </div>
      </div>

      {viewMode === 'all_time' ? (
        <div className="bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden backdrop-blur-sm p-6 space-y-8">
           <div className="text-center mb-4">
              <h3 className="text-xl font-black text-white">Thống Kê NPC Cả Mùa</h3>
              <p className="text-slate-400 text-sm mt-1">Đánh giá độ hiệu quả (ROI) của tất cả NPC bạn từng giao hàng</p>
           </div>
           
           {/* Coin NPCs All Time */}
           {allTimeData?.coinNpcs?.length > 0 && (
           <div>
              <h4 className="text-xl font-bold text-yellow-400 mb-4 flex items-center gap-2 border-b border-slate-700/50 pb-2"><img src={COIN_IMG} className="w-6 h-6 drop-shadow-sm" alt="Coins" /> NPC Trả Coins</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {allTimeData.coinNpcs.map(npc => renderAllTimeCard(npc, 'coin'))}
              </div>
           </div>
           )}

           {/* SFL NPCs All Time */}
           {allTimeData?.sflNpcs?.length > 0 && (
           <div>
              <h4 className="text-xl font-bold text-blue-400 mb-4 flex items-center gap-2 border-b border-slate-700/50 pb-2"><img src="https://sfl.world/img/sfl.webp" className="w-6 h-6"/> NPC Trả SFL</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {allTimeData.sflNpcs.map(npc => renderAllTimeCard(npc, 'sfl'))}
              </div>
           </div>
           )}

           {/* Ticket NPCs All Time */}
           {allTimeData?.ticketNpcs?.length > 0 && (
           <div>
              <h4 className="text-xl font-bold text-purple-400 mb-4 flex items-center gap-2 border-b border-slate-700/50 pb-2"><img src="/shiny_feather.webp" className="w-5 h-5 object-contain" /> NPC Trả Shiny Feathers</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {allTimeData.ticketNpcs.map(npc => renderAllTimeCard(npc, 'ticket'))}
              </div>
           </div>
           )}
        </div>
      ) : (
        <>
          {sortedGroups.length === 0 ? (
            <div className="bg-slate-800/60 rounded-2xl p-8 border border-slate-700/50 shadow-xl backdrop-blur-sm text-center">
              <h3 className="text-xl font-bold text-slate-300 mb-2">Chưa có dữ liệu</h3>
              <p className="text-slate-400">Bạn chưa có lịch sử giao hàng nào được ghi nhận cho chế độ này.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedGroups.map(groupStr => {
                const { coinNpcs, sflNpcs, ticketNpcs } = processedData[groupStr];
                const isExpanded = expandedGroups[groupStr];
                
                // Calculate totals
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
                const totalProfit = dailyCoinTotal.profitSfl + dailySflTotal.profitSfl; 

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
                      <div className={`space-y-1 mt-3 border-t border-slate-700/50 pt-3 mb-3 ${viewMode !== 'day' ? 'max-h-[250px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800' : ''}`}>
                         <div className="text-[10px] uppercase text-slate-500 font-bold mb-1 px-1 sticky top-0 bg-slate-800 z-10 py-1">Chi tiết giao hàng</div>
                     {npc.tasks.map((task, idx) => (
                       <div key={idx} className="flex flex-col gap-1 text-xs px-2 py-1.5 bg-slate-900/30 rounded border border-slate-800/50">
                         <div className="flex justify-between items-start w-full">
                           <div className="flex flex-col mt-0.5">
                              <span className="text-slate-300 font-medium font-mono text-[11px] uppercase tracking-wider bg-slate-800/60 px-1.5 py-0.5 rounded border border-slate-700/50" title="Mã đơn hàng">
                                 {task.count ? `${npc.name.toUpperCase()}_${task.status === 'success' ? 'DONE' : 'SKIP'}_${task.count}` : `LẦN ${idx + 1}`}
                              </span>
                              {viewMode !== 'day' && task.dateStr && (
                                 <span className="text-[9px] text-slate-500 mt-1">{task.dateStr}</span>
                              )}
                           </div>
                           {task.status === 'skipped' ? (
                              <span className="text-red-400/80 font-medium italic mt-0.5 text-xs">Skip</span>
                           ) : (
                              <span className="font-bold flex flex-col items-end">
                                <span className={type === 'coin' ? 'text-yellow-400 flex items-center gap-1' : type === 'ticket' ? 'text-purple-400 flex items-center gap-1' : 'text-blue-400'}>+{task.reward} {type === 'coin' ? <img src={COIN_IMG} className="w-4 h-4 inline-block drop-shadow-sm" alt="Coins"/> : type === 'ticket' ? <img src="/shiny_feather.webp" className="w-4 h-4 inline-block drop-shadow-sm" alt="Feather"/> : 'SFL'}</span>
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
                           +{npc.reward.toFixed(type === 'sfl' ? 4 : 0)} {type === 'coin' ? <img src={COIN_IMG} className="w-4 h-4 inline-block align-text-bottom drop-shadow-sm" alt="Coins"/> : type === 'ticket' ? <img src="/shiny_feather.webp" className="w-4 h-4 inline-block align-text-bottom drop-shadow-sm" alt="Feather"/> : 'SFL'}
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
                  <div key={groupStr} className="bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden backdrop-blur-sm">
                    <div 
                      className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors flex flex-wrap justify-between items-center gap-4 border-b border-slate-700/50"
                      onClick={() => toggleGroup(groupStr)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 flex items-center justify-center min-w-[50px]">
                          <span className="text-lg font-black text-emerald-400">{formatGroupBadge(groupStr)}</span>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">{formatGroupHeader(groupStr)}</h3>
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
                           <h4 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2"><img src={COIN_IMG} className="w-5 h-5 drop-shadow-sm" alt="Coins" /> NPC Trả Coins</h4>
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
                           <h4 className="text-lg font-bold text-purple-400 mb-3 flex items-center gap-2"><img src="/shiny_feather.webp" className="w-5 h-5 object-contain" /> NPC Trả Shiny Feathers</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                             {ticketNpcs.map(npc => renderNpcCard(npc, 'ticket'))}
                           </div>
                           <div className="mt-4 flex flex-wrap gap-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 justify-end">
                              <div className="text-sm"><span className="text-slate-400">Tổng Nhận:</span> <span className="font-bold text-purple-400 flex items-center gap-1 justify-end">{dailyTicketTotal.reward.toFixed(0)} <img src="/shiny_feather.webp" className="w-4 h-4 inline-block drop-shadow-sm" alt="Feather"/></span></div>
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
          )}
        </>
      )}
    </div>
  );
};

export default NpcDailyAnalytics;
