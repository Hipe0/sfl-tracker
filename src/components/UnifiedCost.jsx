import React from 'react';

const UnifiedCost = ({ p2pCost, avgCost }) => {
  if (p2pCost === undefined || p2pCost === null) return null;
  const formatCost = (val) => Number(val).toFixed(2);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs">
      <div className="bg-slate-900/60 px-2 py-0.5 rounded border border-amber-500/30 flex items-center text-amber-200">
        <span className="opacity-70 mr-1">P2P:</span>
        <span className="font-bold text-amber-400">{formatCost(p2pCost)}</span>
      </div>
      {avgCost !== null && avgCost !== undefined && (
        <div className="bg-slate-900/60 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center text-indigo-200">
          <span className="opacity-70 mr-1">AVG:</span>
          <span className="font-bold text-indigo-400">{formatCost(avgCost)}</span>
        </div>
      )}
    </div>
  );
};

export default UnifiedCost;
