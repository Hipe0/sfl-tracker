import React, { useMemo } from 'react';

const CoinDeliveriesPanel = ({ coinDeliveries, globalConfig }) => {
  if (!coinDeliveries || coinDeliveries.length === 0) {
    return (
      <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50 shadow-xl backdrop-blur-sm text-center">
        <p className="text-slate-400">No Coin or SFL deliveries found.</p>
      </div>
    );
  }

  const coinList = coinDeliveries.filter(d => d.type === 'coins');
  const sflList = coinDeliveries.filter(d => d.type === 'sfl');

  const coinRate = parseFloat(globalConfig?.coinRate?.replace(/,/g, '') || '1388');

  const { totalCost, totalProfit } = useMemo(() => {
    let cost = 0;
    let profit = 0;
    coinDeliveries.forEach(d => {
      const c = parseFloat(d.totalP2PCost) || 0;
      cost += c;
      if (d.type === 'coins') {
         const rSfl = (parseFloat(d.rewardAmount) || 0) / coinRate;
         profit += (rSfl - c);
      } else {
         profit += ((parseFloat(d.rewardAmount) || 0) - c);
      }
    });
    return { totalCost: cost, totalProfit: profit };
  }, [coinDeliveries, coinRate]);

  const formatTime = (ms) => {
    if (ms <= 0) return '';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const renderList = (list, title, icon) => (
    <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden backdrop-blur-sm flex flex-col mb-6 animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-900/40 to-slate-800/40 p-4 border-b border-slate-700/50 flex justify-between items-center">
        <h3 className="text-xl font-black text-amber-400 flex items-center gap-2 drop-shadow-sm">
          {icon} {title}
        </h3>
      </div>

      {/* List */}
      <div className="p-4 flex flex-col gap-3">
        {list.map((d, index) => (
          <div key={index} className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-800/50 transition-colors">
            
            {/* NPC Info */}
            <div className="flex items-center gap-3 min-w-[200px]">
              <div className="w-12 h-12 bg-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                <img 
                  src={`https://sfl.world/img/plaza/${encodeURIComponent(d.npcName.toLowerCase())}.png`}
                  alt={d.npcName}
                  className="w-10 h-10 object-contain"
                  onError={(e) => { e.target.outerHTML = '<i class="bi bi-person-circle text-3xl text-blue-400"></i>'; }}
                />
              </div>
              <div>
                <div className="font-bold text-slate-200 text-lg">{d.npcName}</div>
                <div className="text-xs flex gap-2 mt-1">
                  <span className="text-emerald-400 font-medium bg-emerald-400/10 px-2 py-0.5 rounded flex items-center gap-1" title="Completed">
                    <i className="bi bi-check2-circle"></i> {d.deliveryCount} Hoàn thành
                  </span>
                  <span className="text-rose-400 font-medium bg-rose-400/10 px-2 py-0.5 rounded flex items-center gap-1" title="Skipped">
                    <i className="bi bi-x-circle"></i> {d.skippedCount} Bỏ qua
                  </span>
                </div>
              </div>
            </div>

            {/* Requirements */}
            <div className="flex-1 flex flex-wrap gap-2 items-center justify-center">
              {d.reqItems.map((item, i) => (
                <div 
                  key={i} 
                  className={`px-2 py-1.5 rounded-lg border flex items-center gap-2 shadow-sm ${item.enough ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' : 'bg-red-500/10 border-red-500/20 text-red-100'}`}
                >
                  <img 
                    src={`https://sfl.world/img/delivery/${encodeURIComponent(item.name)}.png`}
                    alt={item.name}
                    className="w-5 h-5 object-contain drop-shadow-md"
                    onError={(e) => { e.target.outerHTML = '<span class="mr-2 opacity-80">📦</span>'; }}
                  />
                  <span className="text-xs font-bold flex items-center">
                    {item.completed !== undefined ? `${item.completed} / ` : ''}{item.total} {item.name}
                    {item.enough && <i className="bi bi-check-lg ml-1.5 text-emerald-400 font-black"></i>}
                  </span>
                </div>
              ))}
            </div>

            {/* Reward & Status */}
            <div className="flex flex-col items-end min-w-[140px]">
              <div className="flex items-center gap-2 bg-amber-900/30 px-3 py-1.5 rounded-lg border border-amber-500/20 mb-2">
                {d.type === 'coins' ? (
                  <span className="text-yellow-400 drop-shadow-sm text-lg">🪙</span>
                ) : (
                  <img src="https://sfl.world/img/sfl.png" alt="SFL" className="w-5 h-5 object-contain drop-shadow-md" onError={(e) => { e.target.outerHTML = '<span class="text-yellow-400 drop-shadow-sm text-lg">🌻</span>'; }} />
                )}
                <span className="font-bold text-amber-300 text-lg">+{d.rewardAmount}</span>
              </div>

              <div className="flex flex-col items-end w-full gap-1 mb-2">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                   Chi phí: {d.totalP2PCost.toFixed(4)} SFL
                </span>
                {(() => {
                   let profit = 0;
                   if (d.type === 'coins') {
                      profit = (parseFloat(d.rewardAmount) || 0) / coinRate - (parseFloat(d.totalP2PCost) || 0);
                   } else {
                      profit = (parseFloat(d.rewardAmount) || 0) - (parseFloat(d.totalP2PCost) || 0);
                   }
                   const colorClass = profit >= 0 ? 'text-emerald-400' : 'text-red-400';
                   return (
                      <span className={`text-xs font-bold flex items-center gap-1 ${colorClass}`}>
                         {profit >= 0 ? <i className="bi bi-graph-up-arrow"></i> : <i className="bi bi-graph-down-arrow"></i>}
                         {profit >= 0 ? 'Lời' : 'Lỗ'}: {profit.toFixed(4)} SFL
                      </span>
                   );
                })()}
              </div>
              
              <div className="flex items-center justify-end w-full gap-2 mt-1">
                {d.status === 'claimed' ? (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 uppercase tracking-wider">
                    Completed
                  </span>
                ) : (
                  <div className="flex gap-1 flex-wrap justify-end">
                    {d.canSkip && (
                      <span className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/30 uppercase tracking-wider" title="Có thể bỏ qua (Skip) ngay bây giờ">
                        Skip Ready
                      </span>
                    )}
                    {d.skipWaitTime > 0 && (
                      <span className="bg-slate-700/50 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-600/50 flex items-center gap-1 uppercase tracking-wider" title="Thời gian chờ để được Skip">
                        <i className="bi bi-clock-history"></i> {formatTime(d.skipWaitTime)}
                      </span>
                    )}
                    <span className="bg-sky-500/20 text-sky-400 text-[10px] font-bold px-2 py-0.5 rounded border border-sky-500/30 uppercase tracking-wider">
                      Active
                    </span>
                  </div>
                )}
              </div>
            </div>

          </div>
        ))}
        {list.length === 0 && (
          <div className="text-center py-4 text-slate-500 italic">Không có nhiệm vụ nào.</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in-up">
      {/* Global Total */}
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-xl p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h2 className="text-lg font-bold text-slate-200">Tổng Quan (SFL & Coins)</h2>
           <p className="text-xs text-slate-400">Tỷ giá hiện tại: 1 SFL = {coinRate} Coins</p>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-center">
              <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">Tổng Chi Phí</div>
              <div className="text-xl font-bold text-red-400 font-mono">
                {totalCost.toFixed(5)} SFL
              </div>
           </div>
           <div className="text-center">
              <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">Tổng Lời / Lỗ</div>
              <div className={`text-xl font-bold font-mono ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(5)} SFL
              </div>
           </div>
        </div>
      </div>

      {renderList(sflList, "Flower Deliveries (SFL)", <img src="https://sfl.world/img/sfl.png" className="w-6 h-6 inline-block" onError={(e) => { e.target.outerHTML = '🌻'; }} />)}
      {renderList(coinList, "Coin Deliveries", <span className="text-yellow-400">🪙</span>)}
    </div>
  );
};

export default CoinDeliveriesPanel;
