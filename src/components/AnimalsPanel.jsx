import React, { useState } from 'react';
import { useFarm } from '../context/FarmContext';

const AnimalsPanel = () => {
  const { farmData } = useFarm();
  const animals = farmData?.animals;
  const [showCompleted, setShowCompleted] = useState(false);
  
  if (!animals || animals.length === 0) return null;

  const visibleAnimals = showCompleted ? animals : animals.filter(a => a.status !== 'claimed');

  return (
    <div className="glass-panel">
      <div className="glass-header">
        <span className="flex items-center"><img src="https://sfl.world/img/animals/Chicken.png" alt="Animals" className="w-6 h-6 mr-2 object-contain drop-shadow-sm inline-block" /> Animals</span>
      </div>
      <div className="glass-body">
        <button 
          onClick={() => setShowCompleted(!showCompleted)}
          className="mb-4 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center transition-colors shadow-sm"
        >
          <i className={`bi ${showCompleted ? 'bi-eye-slash' : 'bi-eye'} mr-2`}></i>
          {showCompleted ? 'Hide completed' : 'Show completed'}
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visibleAnimals.map((item, idx) => {
            let bgClass = 'bg-slate-800/80 border-slate-700 text-slate-200';
            
            if (item.status === 'ready') {
              bgClass = 'bg-red-900/20 border-red-500/30 text-red-100';
            }
            if (item.status === 'not_ready') {
              bgClass = 'bg-amber-900/20 border-amber-500/30 text-amber-100';
            }
            if (item.status === 'claimed') {
              bgClass = 'bg-emerald-900/20 border-emerald-500/30 text-emerald-100 opacity-60';
            }
            
            return (
              <div key={idx} className={`p-3 rounded-lg border ${bgClass} relative shadow-sm flex flex-col items-center justify-center text-center`}>
                <div className="text-xs font-bold mb-2 opacity-80">{item.level}</div>
                <div className="flex flex-col items-center mb-2">
                  <img src={`https://sfl.world/img/animals/${encodeURIComponent(item.animalName)}.png`} alt={item.animalName} className="w-10 h-10 object-contain mb-1 drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.style.display='none'; }} />
                  <span className="font-semibold text-sm">{item.animalName}</span>
                </div>
                
                {item.reward > 0 && (
                  <div className="flex justify-between items-center text-xs mt-1 bg-slate-900/40 p-1.5 rounded text-amber-300 font-bold border border-amber-500/10">
                    <span>Reward:</span>
                    <span className="flex items-center"><img src="/shiny_feather.webp" className="w-3.5 h-3.5 mr-1" />{item.reward}</span>
                  </div>
                )}
                {item.status === 'claimed' && (
                  <div className="text-emerald-400 font-bold text-xs mt-1.5 flex items-center justify-center">
                    <i className="bi bi-check-circle-fill mr-1"></i> Đã giao
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

export default AnimalsPanel;
