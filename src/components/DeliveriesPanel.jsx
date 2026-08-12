import React, { useState } from 'react';
import { useFarm } from '../context/FarmContext';
import foodRecipes from '../data/foodRecipes.json';
import FoodTooltip from './FoodTooltip';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const DeliveriesPanel = () => {
  const { farmData } = useFarm();
  const deliveries = farmData?.scrapedDeliveries;
  const [showCompleted, setShowCompleted] = useState(false);
  
  if (!deliveries) return null;

  const filteredDeliveries = showCompleted ? deliveries : deliveries.filter(d => d.status !== 'claimed');
  
  const ticketDeliveries = deliveries.filter(d => d.rewardType === 'Shiny Feather');
  const totalTickets = ticketDeliveries.reduce((sum, d) => sum + (d.rewardAmount || 0), 0);
  const totalCostP2P = ticketDeliveries.reduce((sum, d) => sum + (d.totalP2PCost || 0), 0).toFixed(2);
  const totalClaimed = ticketDeliveries.filter(d => d.status === 'claimed').length;

  const formatTime = (ms) => {
    if (!ms || ms <= 0) return '';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}H ${mins}M`;
  };

  return (
    <div className="glass-panel">
      <div className="glass-header">
        <span className="flex items-center"><img src="https://sfl.world/img/Marketplace.png" alt="Delivery" className="w-6 h-6 mr-2 object-contain drop-shadow-sm" /> Delivery for Tickets</span>
      </div>
      <div className="glass-body">
        {/* Deliveries Summary */}
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-2 text-center md:divide-x divide-y md:divide-y-0 divide-slate-700/50 shadow-inner text-[10px] md:text-xs">
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tiến độ</div>
            <div className="text-lg font-black text-emerald-400">
              {totalClaimed} / {ticketDeliveries.length}
            </div>
          </div>
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center border-t-0">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Tickets</div>
            <div className="text-xl font-black text-yellow-400 flex items-center justify-center">
              {totalTickets} <img src="/shiny_feather.webp" className="w-5 h-5 ml-1.5 drop-shadow-sm" alt="Feather" />
            </div>
          </div>
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Chi Phí P2P</div>
            <div className="text-lg font-black text-rose-400">
              {totalCostP2P} <span className="text-[10px] text-rose-400/70 font-normal">SFL</span>
            </div>
          </div>
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Chi phí trung bình</div>
            <div className="text-lg font-black text-indigo-300">
              {totalTickets > 0 ? (parseFloat(totalCostP2P) / totalTickets).toFixed(2) : '0.00'} <span className="text-[10px] text-indigo-300/70 font-normal">SFL/vé</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-300 uppercase tracking-wider text-sm">NPC Tasks</h3>
          <button 
            onClick={() => setShowCompleted(!showCompleted)}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
          >
            <i className={`bi ${showCompleted ? 'bi-eye-slash' : 'bi-eye'} mr-2`}></i>
            {showCompleted ? 'Hide Claimed' : 'Show Claimed'}
          </button>
        </div>

        <div className="space-y-4">
          {filteredDeliveries.map((del) => {
            let statusBadge = '';
            let statusColor = '';
            
            if (del.status === 'claimed') {
              statusBadge = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
              statusColor = 'from-emerald-900/40 to-slate-800/40 border-emerald-500/30 opacity-70';
            } else if (del.status === 'ready') {
              statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
              statusColor = 'from-amber-900/30 to-slate-800/40 border-amber-500/30';
            } else if (del.status === 'can_skip' || del.canSkip) {
              statusBadge = 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
              statusColor = 'from-purple-900/30 to-slate-800/40 border-purple-500/30';
            } else {
              statusBadge = 'bg-slate-700 text-slate-400';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
            }
            
            return (
              <div key={del.id} className={`rounded-xl border bg-gradient-to-br ${statusColor} shadow-md hover:z-50 transition-all`}>
                <div className="bg-slate-900/60 p-3 font-bold text-sm uppercase flex justify-between items-center border-b border-slate-700/50 rounded-t-xl">
                  <span className="flex items-center text-slate-200 drop-shadow-sm flex-wrap gap-y-1">
                    <img src={`https://sfl.world/img/plaza/${encodeURIComponent(del.npcName.toLowerCase())}.png`} alt={del.npcName} className="w-6 h-6 object-contain mr-2 drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-person-circle mr-2 text-blue-400"></i>'; }} />
                    <span className="mr-1">{del.npcName}</span>
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black shadow-inner flex items-center gap-1 ${statusBadge}`}>
                    {del.rewardType === 'Coins' && <img src={COIN_IMG} className="w-4 h-4 object-contain inline-block drop-shadow-sm" alt="Coins" />}
                    {del.rewardType === 'Gem' && <span className="text-purple-400 drop-shadow-sm">💎</span>}
                    {del.rewardType === 'Shiny Feather' && <img src="/shiny_feather.webp" className="w-4 h-4 object-contain inline-block drop-shadow-sm" />}
                    {del.rewardAmount}
                  </span>
                </div>
                <div className="p-3">
                  {del.reqItems.length > 0 ? (
                    <div className="space-y-1.5 mb-3">
                      {del.reqItems.map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`px-3 py-1.5 rounded-full border flex items-center justify-between text-xs shadow-sm hover:z-50 transition-colors ${item.enough ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100' : 'bg-slate-800/80 border-slate-700/80 text-slate-200'}`}
                        >
                          <div className={`flex items-center gap-2 group relative ${foodRecipes[item.name] ? 'cursor-help' : ''}`}>
                            <div className="w-6 h-6 flex items-center justify-center shrink-0">
                              <img src={`https://sfl.world/img/delivery/${encodeURIComponent(item.name)}.png`} alt={item.name} className="max-w-full max-h-full object-contain drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<span class="mr-2 opacity-80">📦</span>'; }} />
                            </div>
                            <span className={`font-semibold text-[11px] truncate ${foodRecipes[item.name] ? 'border-b border-dashed border-emerald-500/50 pb-0.5' : ''}`}>{item.name}</span>
                            <FoodTooltip foodName={item.name} farmData={farmData} />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            <span className="font-mono font-bold text-[11px] bg-slate-900/40 px-1.5 py-0.5 rounded text-white">
                              {Number.isInteger(item.completed) ? item.completed : parseFloat(Number(item.completed).toFixed(2))} <span className="text-slate-500 font-normal">/</span> {item.total}
                            </span>
                            {item.enough && <i className="bi bi-check-circle-fill text-emerald-400 text-sm drop-shadow-sm ml-0.5"></i>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-sm italic py-3 text-center bg-slate-900/30 rounded-lg mb-3">No requirements found</div>
                  )}
                  
                  {/* Status & Checkmark (Matches Deliveries UI) */}
                  <div className="mt-auto flex flex-col gap-2 relative border-t border-slate-700/50 pt-2">
                    <div className="w-full flex flex-wrap justify-between items-center text-[10px] font-bold gap-y-2">
                      {/* Left side: Status or Checkmark */}
                      <div className="flex items-center gap-2">
                        {del.status === 'claimed' ? (
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                            <span className="font-black text-sm leading-none -mt-0.5">✓</span> Đã Giao
                          </span>
                        ) : (
                          <>
                            {(del.status === 'can_skip' || del.canSkip) && (
                              <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30 uppercase tracking-wider whitespace-nowrap">
                                SKIP READY
                              </span>
                            )}
                            {(del.skipWaitTime > 0 && del.status !== 'can_skip' && !del.canSkip) && (
                              <span className="bg-slate-700/50 text-slate-400 px-2 py-1 rounded border border-slate-600/50 flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                                {formatTime(del.skipWaitTime)}
                              </span>
                            )}
                            {(!del.canSkip && (!del.skipWaitTime || del.skipWaitTime <= 0) && del.status !== 'can_skip') && (
                              <span className="bg-sky-500/20 text-sky-400 px-2 py-1 rounded border border-sky-500/30 uppercase tracking-wider whitespace-nowrap">
                                ACTIVE
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Right side: Show P2P cost and average cost */}
                      {del.totalP2PCost > 0 && (
                         <div className="ml-auto flex flex-wrap sm:flex-nowrap items-center gap-2 justify-end">
                           <span className="text-slate-400 font-mono text-[10px] whitespace-nowrap">
                             Chi phí: {(parseFloat(del.totalP2PCost) || 0).toFixed(2)} SFL
                           </span>
                           <span className="text-slate-600 hidden sm:inline">|</span>
                           <span className="text-indigo-400 font-mono font-bold text-[11px] whitespace-nowrap" title="Chi phí SFL cho mỗi 1 Vé">
                             1 <img src="/shiny_feather.webp" className="w-3 h-3 inline-block -mt-0.5 opacity-90 drop-shadow-sm" /> = {del.rewardAmount > 0 ? (parseFloat(del.totalP2PCost) / del.rewardAmount).toFixed(3) : 0} SFL
                           </span>
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DeliveriesPanel;
