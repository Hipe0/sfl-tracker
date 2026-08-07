import React, { useState } from 'react';
import UnifiedCost from './UnifiedCost';
import { useFarm } from '../context/FarmContext';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const BountiesPanel = () => {
  const { farmData } = useFarm();
  let bounties = farmData?.bounties || [];
  const poppyBounty = farmData?.summary?.poppyBounty;
  const [showCompleted, setShowCompleted] = useState(false);
  
  // Always append the poppy bounty bonus to the bounties array to render it
  // If it's present in summary, we use its status. Otherwise, we assume it's not ready.
  const poppyStatus = poppyBounty?.status === 'success' ? 'claimed' : 'not_ready';
  
  bounties = [...bounties, {
    name: 'Poppy Bounty Bonus',
    completed: poppyStatus === 'claimed' ? 1 : 0,
    total: 1,
    reward: 50,
    rewardType: 'Shiny Feather',
    status: poppyStatus
  }];

  if (!bounties || bounties.length === 0) return null;

  const visibleBounties = showCompleted ? bounties : bounties.filter(b => b.status !== 'claimed');

  // Calculate totals
  let totalTickets = 0;
  let totalCost = 0;

  bounties.forEach(item => {
    if (item.rewardType === 'Shiny Feather' && item.reward) {
      totalTickets += item.reward;
    }
    if (item.totalP2PCost) {
      totalCost += parseFloat(item.totalP2PCost);
    }
  });

  const avgCostPerTicket = totalTickets > 0 ? (totalCost / totalTickets) : 0;

  return (
    <div className="glass-panel">
      <div className="glass-header">
        <span className="flex items-center"><img src="https://sfl.world/assets/icons/trophy.png" alt="Bounties" className="w-6 h-6 mr-2 object-contain drop-shadow-sm inline-block" /> Bounties</span>
      </div>
      <div className="glass-body">
        <button 
          onClick={() => setShowCompleted(!showCompleted)}
          className="mb-4 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
        >
          <i className={`bi ${showCompleted ? 'bi-eye-slash' : 'bi-eye'} mr-2`}></i>
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>

        {/* Bounties Summary */}
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-2 text-center md:divide-x divide-y md:divide-y-0 divide-slate-700/50 shadow-inner">
          <div className="px-2 py-2 md:py-0">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Max Tickets (Bao gồm +50 Bonus)</div>
            <div className="text-xl font-black text-yellow-400 flex items-center justify-center">
              {totalTickets} <img src="/shiny_feather.webp" className="w-5 h-5 ml-1.5 drop-shadow-sm" />
            </div>
          </div>
          <div className="px-2 py-2 md:py-0">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Chi Phí (Full Bounties)</div>
            <div className="text-xl font-black text-rose-400">
              {totalCost.toFixed(2)} <span className="text-xs text-rose-400/70 font-normal">SFL</span>
            </div>
          </div>
          <div className="px-2 py-2 md:py-0">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Chi phí trung bình / 1 Vé</div>
            <div className="text-xl font-black text-indigo-300">
              {avgCostPerTicket.toFixed(2)} <span className="text-xs text-indigo-300/70 font-normal">SFL/vé</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {visibleBounties.map((item, idx) => {
            let bgClass = 'bg-slate-800/80 border-slate-700 text-slate-200';
            let progressClass = 'progress-danger';
            
            if (item.status === 'ready') {
              bgClass = 'bg-amber-900/20 border-amber-500/30 text-amber-100';
              progressClass = 'progress-warning';
            }
            if (item.status === 'claimed') {
              bgClass = 'bg-emerald-900/20 border-emerald-500/30 text-emerald-100 opacity-60';
              progressClass = 'progress-success';
            }
            
            const percent = item.total > 0 ? Math.min(100, Math.round((item.completed / item.total) * 100)) : (item.status === 'claimed' ? 100 : 0);

            return (
              <div key={idx} className={`p-3 rounded-lg border ${bgClass} relative shadow-sm`}>
                <div className="flex justify-between items-start md:items-center text-sm font-medium relative z-10 mb-2 flex-col md:flex-row gap-2 md:gap-0">
                  <span className="flex flex-col items-start">
                    <span className="flex items-center">
                      <img src={`https://sfl.world/img/delivery/${encodeURIComponent(item.name)}.png`} alt={item.name} className="w-6 h-6 object-contain mr-2 drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-bullseye mr-2 opacity-70"></i>'; }} /> 
                      {item.name}
                    </span>
                    <UnifiedCost 
                      p2pCost={item.totalP2PCost} 
                      avgCost={item.avgCost} 
                      rewardType={item.rewardType}
                    />
                  </span>
                  <span className="text-right flex items-center bg-slate-900/50 px-2 py-1 rounded-md text-xs">
                    <span className="font-mono">{item.completed} / {item.total}</span>
                    {item.reward > 0 && (
                      <span className="ml-2 font-bold text-yellow-400 drop-shadow-sm flex items-center gap-1">
                        {item.rewardType === 'Coins' && <img src={COIN_IMG} className="w-4 h-4 object-contain inline-block drop-shadow-sm" alt="Coins" />}
                        {item.rewardType === 'Gem' && <span className="text-purple-400 drop-shadow-sm">💎</span>}
                        {item.rewardType === 'Shiny Feather' && <img src="/shiny_feather.webp" className="w-4 h-4 object-contain inline-block drop-shadow-sm" />}
                        {item.reward}
                      </span>
                    )}
                  </span>
                </div>
                {item.total > 0 && (
                  <div className="progress-container relative z-10">
                    <div className={`progress-fill ${progressClass}`} style={{ width: `${percent}%` }}></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BountiesPanel;
