import React, { useState } from 'react';
import UnifiedCost from './UnifiedCost';

const DeliveriesPanel = ({ deliveries }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  
  if (!deliveries) return null;

  const filteredDeliveries = showCompleted ? deliveries : deliveries.filter(d => d.status !== 'claimed');
  
  const ticketDeliveries = deliveries.filter(d => d.rewardType === 'Shiny Feather');
  const totalTickets = ticketDeliveries.reduce((sum, d) => sum + (d.rewardAmount || 0), 0);
  const totalCostP2P = ticketDeliveries.reduce((sum, d) => sum + (d.totalP2PCost || 0), 0).toFixed(2);
  const totalClaimed = ticketDeliveries.filter(d => d.status === 'claimed').length;

  return (
    <div className="glass-panel">
      <div className="glass-header">
        <span className="flex items-center"><img src="https://sfl.world/img/Marketplace.png" alt="Delivery" className="w-6 h-6 mr-2 object-contain drop-shadow-sm" /> Delivery for Tickets</span>
      </div>
      <div className="glass-body">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 mb-5 shadow-inner">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-300 font-medium">Total Shiny Feathers</span>
            <span className="font-bold text-yellow-400 flex items-center text-lg">
              <span className="mr-2 text-xl drop-shadow-sm">🪶</span> {totalTickets}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-300 font-medium">Total Cost P2P (Feathers Only)</span>
            <span className="font-bold text-slate-200 flex items-center">
              <span className="mr-2 drop-shadow-sm">🌻</span> {totalCostP2P}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
            <span className="text-slate-300 font-medium">Feather Tasks Claimed</span>
            <span className="font-bold text-emerald-400 flex items-center">
              <i className="bi bi-check2-circle mr-2"></i> {totalClaimed} / {ticketDeliveries.length}
            </span>
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
              statusColor = 'from-emerald-900/40 to-slate-800/40 border-emerald-500/30';
            } else if (del.status === 'ready') {
              statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
              statusColor = 'from-amber-900/30 to-slate-800/40 border-amber-500/30';
            } else {
              statusBadge = 'bg-slate-700 text-slate-400';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
            }
            
            return (
              <div key={del.id} className={`rounded-xl overflow-hidden border bg-gradient-to-br ${statusColor} shadow-md transition-all`}>
                <div className="bg-slate-900/60 p-3 font-bold text-sm uppercase flex justify-between items-center border-b border-slate-700/50">
                  <span className="flex items-center text-slate-200 drop-shadow-sm">
                    <img src={`https://sfl.world/img/plaza/${encodeURIComponent(del.npcName.toLowerCase())}.png`} alt={del.npcName} className="w-6 h-6 object-contain mr-2 drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-person-circle mr-2 text-blue-400"></i>'; }} /> {del.npcName}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black shadow-inner flex items-center gap-1 ${statusBadge}`}>
                    {del.rewardType === 'Coins' && <span className="text-yellow-400 drop-shadow-sm">🪙</span>}
                    {del.rewardType === 'Gem' && <span className="text-purple-400 drop-shadow-sm">💎</span>}
                    {del.rewardType === 'Shiny Feather' && <span className="text-blue-300 drop-shadow-sm">🪶</span>}
                    {del.reward}
                  </span>
                </div>
                <div className="p-3">
                  {del.reqItems.length > 0 ? (
                    <div className="space-y-1.5">
                      {del.reqItems.map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`flex justify-between items-center p-2 rounded-lg text-sm font-medium border ${item.enough ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' : 'bg-red-500/10 border-red-500/20 text-red-100'}`}
                        >
                          <span className="flex items-center">
                            <img src={`https://sfl.world/img/delivery/${encodeURIComponent(item.name)}.png`} alt={item.name} className="w-5 h-5 object-contain mr-2 drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<span class="mr-2 opacity-80">📦</span>'; }} /> {item.name}
                          </span>
                          <span className="flex items-center">
                            {item.completed} <span className="mx-1 text-slate-500">/</span> {item.total}
                            {item.enough && <i className="bi bi-check-lg ml-2 text-emerald-400 font-black"></i>}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-sm italic py-3 text-center bg-slate-900/30 rounded-lg">No requirements found</div>
                  )}
                  
                  <UnifiedCost 
                    marketCost={del.totalMarketCost} 
                    p2pCost={del.totalP2PCost} 
                    avgCost={del.rewardType === 'Shiny Feather' ? del.avgCost : null} 
                  />
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
