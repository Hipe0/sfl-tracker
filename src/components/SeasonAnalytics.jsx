import React, { useState, useEffect, useMemo } from 'react';

const SeasonAnalytics = ({ farmData, farmId, refreshKey }) => {
  const [history, setHistory] = useState({ deliveries: {}, chores: {}, bounties_completed: {}, animals_completed: {}, daily_chest: {} });
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('sfl_player_name') || 'Nông dân Ẩn danh');

  useEffect(() => {
    if (farmData?.globalConfig?.playerName) {
      setPlayerName(farmData.globalConfig.playerName);
      localStorage.setItem('sfl_player_name', farmData.globalConfig.playerName);
    }
  }, [farmData]);

  const handleNameChange = (e) => {
    setPlayerName(e.target.value);
    localStorage.setItem('sfl_player_name', e.target.value);
  };

  const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/api/farm/${farmId}/history?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.data || { deliveries: {}, chores: {}, bounties_completed: {}, animals_completed: {}, daily_chest: {} });
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

  const handleSyncAndRefresh = async () => {
    try {
      setIsSyncing(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      // Force scrape on backend
      await fetch(`${apiUrl}/api/farm/${farmId}`);
      // Refetch history
      await fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Derive weeks from deliveries, chores, and bounties to display them grouped
  const { sortedWeeks, seasonTotal, weeksData } = useMemo(() => {
    const weeksSet = new Set();
    const dataByWeek = {};
    
    let totalSeasonCost = 0;
    let totalSeasonTickets = 0;
    
    // Helper to get week string from a date string (YYYY-MM-DD -> YYYY-W##)
    const getWeekStr = (dateStr) => {
      const d = new Date(dateStr);
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    };

    // 1. Process Deliveries
    if (history.deliveries) {
      Object.keys(history.deliveries).forEach(dateStr => {
        const weekStr = getWeekStr(dateStr);
        weeksSet.add(weekStr);
        if (!dataByWeek[weekStr]) dataByWeek[weekStr] = { deliveries: {}, chores: { completed: 0, cost: 0 }, bounties: { completed: 0, cost: 0 }, animals: { completed: 0 }, vip: { completed: 0 }, summary: { tickets: 0, cost: 0 } };
        
        const dayDeliveries = history.deliveries[dateStr];
        dataByWeek[weekStr].deliveries[dateStr] = dayDeliveries;
        
        dayDeliveries.forEach(d => {
          const cost = d.totalP2PCost ? parseFloat(d.totalP2PCost) : 0;
          dataByWeek[weekStr].summary.tickets += (d.reward || 0);
          dataByWeek[weekStr].summary.cost += cost;
          totalSeasonTickets += (d.reward || 0);
          totalSeasonCost += cost;
        });
      });
    }

    // 2. Process Chores
    if (history.chores) {
      Object.keys(history.chores).forEach(weekStr => {
        weeksSet.add(weekStr);
        if (!dataByWeek[weekStr]) dataByWeek[weekStr] = { deliveries: {}, chores: { completed: 0, cost: 0 }, bounties: { completed: 0, cost: 0 }, animals: { completed: 0 }, vip: { completed: 0 }, summary: { tickets: 0, cost: 0 } };
        
        const c = history.chores[weekStr];
        dataByWeek[weekStr].chores = c;
        dataByWeek[weekStr].summary.tickets += (c.completed || 0);
        dataByWeek[weekStr].summary.cost += (c.cost || 0);
        totalSeasonTickets += (c.completed || 0);
        totalSeasonCost += (c.cost || 0);
      });
    }

    // 3. Process Bounties
    if (history.bounties_completed) {
      Object.keys(history.bounties_completed).forEach(bName => {
        const b = history.bounties_completed[bName];
        const weekStr = b.week;
        weeksSet.add(weekStr);
        if (!dataByWeek[weekStr]) dataByWeek[weekStr] = { deliveries: {}, chores: { completed: 0, cost: 0 }, bounties: { completed: 0, cost: 0 }, animals: { completed: 0 }, vip: { completed: 0 }, summary: { tickets: 0, cost: 0 } };
        
        dataByWeek[weekStr].bounties.completed += (b.reward || 0);
        dataByWeek[weekStr].bounties.cost += (b.cost || 0);
        
        dataByWeek[weekStr].summary.tickets += (b.reward || 0);
        dataByWeek[weekStr].summary.cost += (b.cost || 0);
        
        totalSeasonTickets += (b.reward || 0);
        totalSeasonCost += (b.cost || 0);
      });
    }

    // 4. Process Animals
    if (history.animals_completed) {
      Object.keys(history.animals_completed).forEach(aKey => {
        const a = history.animals_completed[aKey];
        const weekStr = a.week;
        weeksSet.add(weekStr);
        if (!dataByWeek[weekStr]) dataByWeek[weekStr] = { deliveries: {}, chores: { completed: 0, cost: 0 }, bounties: { completed: 0, cost: 0 }, animals: { completed: 0 }, vip: { completed: 0 }, summary: { tickets: 0, cost: 0 } };
        
        dataByWeek[weekStr].animals.completed += (a.reward || 0);
        
        dataByWeek[weekStr].summary.tickets += (a.reward || 0);
        totalSeasonTickets += (a.reward || 0);
      });
    }

    // 5. Process VIP Daily Chest
    if (history.daily_chest) {
      Object.keys(history.daily_chest).forEach(dateStr => {
        const weekStr = getWeekStr(dateStr);
        weeksSet.add(weekStr);
        if (!dataByWeek[weekStr]) dataByWeek[weekStr] = { deliveries: {}, chores: { completed: 0, cost: 0 }, bounties: { completed: 0, cost: 0 }, animals: { completed: 0 }, vip: { completed: 0 }, summary: { tickets: 0, cost: 0 } };
        
        const d = history.daily_chest[dateStr];
        dataByWeek[weekStr].vip.completed += (d.reward || 0);
        dataByWeek[weekStr].summary.tickets += (d.reward || 0);
        totalSeasonTickets += (d.reward || 0);
      });
    }

    // Sort weeks descending (newest first)
    const sorted = Array.from(weeksSet).sort((a, b) => b.localeCompare(a));

    return {
      sortedWeeks: sorted,
      seasonTotal: { cost: totalSeasonCost, tickets: totalSeasonTickets },
      weeksData: dataByWeek
    };
  }, [history]);

  const getWeekDateRange = (weekStr) => {
    try {
      const [yearStr, weekNoStr] = weekStr.split('-W');
      const year = parseInt(yearStr, 10);
      const week = parseInt(weekNoStr, 10);
      
      const d = new Date(Date.UTC(year, 0, 4));
      const dayNum = d.getUTCDay() || 7; 
      d.setUTCDate(d.getUTCDate() - dayNum + 1);
      d.setUTCDate(d.getUTCDate() + (week - 1) * 7);
      
      const endDate = new Date(d);
      endDate.setUTCDate(endDate.getUTCDate() + 6);
      
      const formatDate = (date) => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      return `Từ ${formatDate(d)} đến ${formatDate(endDate)}`;
    } catch(e) {
      return weekStr;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/20 p-5 rounded-2xl shadow-lg flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-4 mb-2 flex-wrap">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <i className="bi bi-graph-up-arrow text-blue-400 mr-3"></i> Season Analytics
            </h2>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-900/60 border border-indigo-500/40 text-indigo-200 text-sm font-semibold shadow-inner">
              <i className="bi bi-person-badge text-indigo-400"></i>
              <input 
                type="text" 
                value={playerName}
                onChange={handleNameChange}
                className="bg-transparent border-none outline-none text-indigo-200 placeholder-indigo-400/50 w-32 focus:ring-0 p-0 text-sm font-bold"
                placeholder="Nhập tên..."
                title="Click để đổi tên hiển thị"
              />
              <span className="text-indigo-400/30 font-light">|</span>
              <span className="font-mono text-indigo-300">ID: {farmId}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-blue-200/70 text-sm">Your ledger for the entire season, broken down by week.</p>
            <button 
              onClick={handleSyncAndRefresh} 
              disabled={isSyncing || loadingHistory}
              title="Force sync with sfl.world" 
              className={`px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-colors text-xs font-bold flex items-center gap-1.5 ${(isSyncing || loadingHistory) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <i className={`bi bi-arrow-repeat ${isSyncing ? 'animate-spin' : ''}`}></i>
              {isSyncing ? 'Syncing...' : 'Cập nhật từ SFL'}
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-700/50">
          <div className="text-center px-3 border-r border-slate-700/50">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Season Tickets</div>
            <div className="text-xl font-black text-yellow-400 flex items-center justify-center">
              <span className="text-sm mr-1">🪶</span>{seasonTotal.tickets}
            </div>
          </div>
          <div className="text-center px-3">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Season P2P Cost</div>
            <div className="text-xl font-black text-rose-400 flex items-center justify-center">
              {seasonTotal.cost.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {loadingHistory ? (
          <div className="text-center py-8 text-slate-400 glass-panel">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full mb-2"></div>
            <p>Loading season history...</p>
          </div>
        ) : sortedWeeks.length === 0 ? (
          <div className="text-center py-12 text-slate-400 glass-panel">
            <i className="bi bi-journal-x text-4xl mb-3 block text-slate-600"></i>
            <p>No history recorded yet for this season.</p>
            <p className="text-sm mt-2 text-slate-500">Scan your farm to start recording data automatically!</p>
          </div>
        ) : (
          sortedWeeks.map(weekStr => {
            const data = weeksData[weekStr];
            // Format days inside the week
            const daysInWeek = Object.keys(data.deliveries).sort();
            
            return (
              <div key={weekStr} className="glass-panel overflow-hidden">
                <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-200 text-lg flex items-center gap-2">
                    <i className="bi bi-calendar3 text-indigo-400"></i> {getWeekDateRange(weekStr)} <span className="text-xs text-slate-500 font-normal ml-1">({weekStr})</span>
                  </h3>
                  <div className="flex items-center gap-3 text-sm font-semibold">
                    <span className="text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-md border border-yellow-400/20">
                      +{data.summary.tickets} 🪶
                    </span>
                    <span className="text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded-md border border-rose-400/20">
                      {data.summary.cost.toFixed(2)} SFL
                    </span>
                  </div>
                </div>
                
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Chores & Bounties */}
                  <div className="flex flex-col gap-3 col-span-1">
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <img src="https://sfl.world/img/delivery/Chore%20Board.png" alt="Chores" className="w-7 h-7 object-contain drop-shadow-md" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">Weekly Chores</div>
                          <div className="text-xs text-slate-400">Recorded for this week</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-yellow-400 text-sm">+{data.chores.completed} 🪶</div>
                        <div className="text-xs text-rose-400">{data.chores.cost.toFixed(2)} SFL</div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                          <img src="https://sfl.world/img/delivery/Bounty%20Board.png" alt="Bounties" className="w-7 h-7 object-contain drop-shadow-md" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">Bounties</div>
                          <div className="text-xs text-slate-400">Completed this week</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-yellow-400 text-sm">+{data.bounties.completed} 🪶</div>
                        <div className="text-xs text-rose-400">{data.bounties.cost.toFixed(2)} SFL</div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
                          <img src="https://sfl.world/img/delivery/Cow.png" alt="Animals" className="w-7 h-7 object-contain drop-shadow-md" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">Animals</div>
                          <div className="text-xs text-slate-400">Claimed this week</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-yellow-400 text-sm">+{data.animals.completed} 🪶</div>
                        <div className="text-xs text-rose-400">0.00 SFL</div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <img src="/img/vip.webp" alt="VIP Access" className="w-8 h-8 object-contain drop-shadow-md" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-200">VIP Gift</div>
                          <div className="text-xs text-slate-400">Claimed this week</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-yellow-400 text-sm">+{data.vip.completed} 🪶</div>
                        <div className="text-xs text-rose-400">0.00 SFL</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Deliveries List */}
                  <div className="col-span-1 md:col-span-2 bg-slate-800/30 rounded-xl border border-slate-700/30 p-3">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <img src="https://sfl.world/img/delivery/Delivery%20Box.png" alt="Deliveries" className="w-4 h-4 object-contain drop-shadow-sm" /> Daily Deliveries
                    </h4>
                    
                    {daysInWeek.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs italic">
                        No deliveries recorded for this week.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {daysInWeek.map(dateStr => {
                          const dayDeliveries = data.deliveries[dateStr];
                          const dayCost = dayDeliveries.reduce((sum, d) => sum + (d.totalP2PCost ? parseFloat(d.totalP2PCost) : 0), 0);
                          const dayTickets = dayDeliveries.reduce((sum, d) => sum + (d.reward || 0), 0);
                          
                          const dObj = new Date(dateStr);
                          const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dObj.getDay()];
                          
                          return (
                            <div key={dateStr} className="bg-slate-900/40 rounded-lg border border-slate-700/30 overflow-hidden">
                              <div className="px-3 py-1.5 bg-slate-800/60 flex justify-between items-center text-xs border-b border-slate-700/30">
                                <span className="font-bold text-slate-300">{dayName}, {dateStr}</span>
                                <span className="text-slate-400 font-semibold flex gap-2">
                                  <span className="text-yellow-400">+{dayTickets} 🪶</span>
                                  <span className="text-rose-400">{dayCost.toFixed(2)} SFL</span>
                                </span>
                              </div>
                              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {dayDeliveries.map((item, j) => (
                                  <div key={j} className="flex justify-between items-center bg-slate-800/40 px-2 py-1.5 rounded-md text-[11px]">
                                    <span className="font-medium text-slate-300 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {item.npcName}
                                    </span>
                                    <span className="text-slate-400 flex items-center gap-2">
                                      <span className="text-rose-300">{item.totalP2PCost ? parseFloat(item.totalP2PCost).toFixed(2) : '0.00'}</span>
                                      <span className="text-yellow-400 font-bold text-xs">{item.reward}</span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default SeasonAnalytics;
