import React, { useState } from 'react';
import UnifiedCost from './UnifiedCost';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const BountiesPanel = ({ bounties }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  
  if (!bounties || bounties.length === 0) return null;

  const visibleBounties = showCompleted ? bounties : bounties.filter(b => b.status !== 'claimed');

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
