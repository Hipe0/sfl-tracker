import React from 'react';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const UnifiedCost = ({ p2pCost, avgCost, rewardType }) => {
  if (p2pCost === undefined || p2pCost === null) return null;
  const formatCost = (val) => Number(val).toFixed(2);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs">
      <div className="bg-slate-900/60 px-2 py-0.5 rounded border border-amber-500/30 flex items-center text-amber-200" title="Chi phí P2P">
        <span className="opacity-70 mr-1 flex items-center gap-1">
          P2P <img src="data:image/webp;base64,UklGRmoAAABXRUJQVlA4TF0AAAAvCAACED9AEABhy6QuDwK4sEGYbTR/nQGc1v1GJABhgW6ER47rfpj/APDeVAtiumQ0B2wCsG0rSZ8IhEIohImiO+vfbUT/A/8kprxh5UiPIs4UPng00crilB/wTwIA" className="w-3 h-3 object-contain inline-block drop-shadow-sm" alt="Flower" />:
        </span>
        <span className="font-bold text-amber-400">{formatCost(p2pCost)}</span>
      </div>
      {avgCost !== null && avgCost !== undefined && (
        <div className="bg-slate-900/60 px-2 py-0.5 rounded border border-indigo-500/30 flex items-center text-indigo-200" title={`Chi phí SFL cho mỗi 1 ${rewardType || 'Shiny Feather'}`}>
          <span className="opacity-70 mr-1 flex items-center gap-1">
            1 
            {(!rewardType || rewardType === 'Shiny Feather') && <img src="/shiny_feather.webp" className="w-3 h-3 object-contain inline-block drop-shadow-sm" />}
            {rewardType === 'Gem' && <span className="text-[10px]">💎</span>}
            {rewardType === 'Coins' && <img src={COIN_IMG} className="w-3 h-3 object-contain inline-block drop-shadow-sm" alt="Coins" />}
            = 
          </span>
          <span className="font-bold text-indigo-400">{formatCost(avgCost)} SFL</span>
        </div>
      )}
    </div>
  );
};

export default UnifiedCost;
