import React, { useState } from 'react';
import UnifiedCost from './UnifiedCost';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const ChoresPanel = ({ chores }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  
  if (!chores || chores.length === 0) return null;

  const getChoreImage = (name, itemType) => {
    let imgName = itemType;
    if (name.includes('Fish') || imgName === 'Fishing Rod') return 'Rod';
    if (name.includes('Egg')) return 'Egg';
    if (name.includes('Milk')) return 'Milk';
    if (name.includes('Stones')) return 'Stone';
    
    // Attempt to extract crop names from "Grow X 5 times"
    const growMatch = name.match(/Grow\s+([A-Za-z\s]+)\s+\d+\s+times/i);
    if (growMatch) return growMatch[1].trim();
    
    return imgName;
  };

  return (
    <div className="glass-panel">
      <div className="glass-header">
        <span className="flex items-center"><img src="https://sfl.world/assets/icons/chores.webp" alt="Chores" className="w-6 h-6 mr-2 object-contain drop-shadow-sm inline-block" /> Weekly Chores</span>
      </div>
      <div className="glass-body">
        <button 
          onClick={() => setShowCompleted(!showCompleted)}
          className="mb-4 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
        >
          <i className={`bi ${showCompleted ? 'bi-eye-slash' : 'bi-eye'} mr-2`}></i>
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>

        <div className="space-y-6">
          {chores.map((category, idx) => {
            const visibleItems = showCompleted ? category.items : category.items.filter(i => i.status !== 'claimed');
            if (visibleItems.length === 0) return null;
            
            return (
              <div key={idx} className="bg-slate-800/30 p-3 rounded-xl border border-slate-700/30">
                <h3 className="font-bold text-slate-200 mb-3 flex items-center text-sm uppercase tracking-wider">
                  <i className="bi bi-bookmark-star-fill mr-2 text-indigo-400"></i> {category.category}
                </h3>
                <div className="space-y-3">
                  {visibleItems.map((item, iIdx) => {
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
                      <div key={iIdx} className={`p-3 rounded-lg border ${bgClass} relative shadow-sm`}>
                        <div className="flex justify-between items-start md:items-center text-sm font-medium relative z-10 mb-2 flex-col md:flex-row gap-2 md:gap-0">
                          <span className="flex flex-col items-start">
                            <span className="flex items-center">
                              {getChoreImage(item.name, item.itemType) ? (
                                <img src={`https://sfl.world/img/delivery/${encodeURIComponent(getChoreImage(item.name, item.itemType))}.png`} alt={getChoreImage(item.name, item.itemType)} className="w-5 h-5 object-contain mr-2 drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-circle-fill text-[8px] mr-2 opacity-50"></i>'; }} />
                              ) : (
                                <i className="bi bi-circle-fill text-[8px] mr-2 opacity-50"></i>
                              )}
                              {item.name}
                            </span>
                            <UnifiedCost 
                              marketCost={item.totalMarketCost} 
                              p2pCost={item.totalP2PCost} 
                              avgCost={item.avgCost}
                              rewardType={item.rewardType}
                            />
                          </span>
                          <span className="text-right flex items-center bg-slate-900/50 px-2 py-1 rounded-md text-xs mt-2 md:mt-0">
                            {item.total > 0 && <span className="font-mono">{item.completed} / {item.total}</span>}
                            {item.reward > 0 && (
                              <span className="ml-2 font-bold text-yellow-400 drop-shadow-sm flex items-center gap-1">
                                {item.rewardType === 'Coins' && <img src={COIN_IMG} className="w-4 h-4 object-contain inline-block drop-shadow-sm" alt="Coins" />}
                                {item.rewardType === 'Gem' && <span className="text-purple-400">💎</span>}
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChoresPanel;
