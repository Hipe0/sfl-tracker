import React, { useState } from 'react';
import UnifiedCost from './UnifiedCost';

const ChoresPanel = ({ chores }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  
  if (!chores || chores.length === 0) return null;

  return (
    <div className="glass-panel">
      <div className="glass-header">
        <span><i className="bi bi-card-checklist mr-2 text-rose-400"></i>Weekly Chores</span>
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
                              <i className="bi bi-circle-fill text-[8px] mr-2 opacity-50"></i> {item.name}
                            </span>
                            <UnifiedCost 
                              marketCost={item.totalMarketCost} 
                              p2pCost={item.totalP2PCost} 
                              avgCost={item.rewardType === 'Shiny Feather' ? item.avgCost : null} 
                            />
                          </span>
                          <span className="text-right flex items-center bg-slate-900/50 px-2 py-1 rounded-md text-xs mt-2 md:mt-0">
                            {item.total > 0 && <span className="font-mono">{item.completed} / {item.total}</span>}
                            {item.reward > 0 && (
                              <span className="ml-2 font-bold text-yellow-400 drop-shadow-sm flex items-center gap-1">
                                {item.rewardType === 'Coins' && <span className="text-yellow-400">🪙</span>}
                                {item.rewardType === 'Gem' && <span className="text-purple-400">💎</span>}
                                {item.rewardType === 'Shiny Feather' && <span className="text-blue-300">🪶</span>}
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
