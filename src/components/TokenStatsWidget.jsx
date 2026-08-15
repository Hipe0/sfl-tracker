import React from 'react';
import { useFarm } from '../context/FarmContext';

const FLOWER_IMG = 'data:image/webp;base64,UklGRmoAAABXRUJQVlA4TF0AAAAvCAACED9AEABhy6QuDwK4sEGYbTR/nQGc1v1GJABhgW6ER47rfpj/APDeVAtiumQ0B2wCsG0rSZ8IhEIohImiO+vfbUT/A/8kprxh5UiPIs4UPng00crilB/wTwIA';
const COIN_IMG = 'data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=';

const TokenStatsWidget = () => {
  const { farmData } = useFarm();
  
  if (!farmData || !farmData.marketStats) return null;
  
  const { flowerUsdPrice, bestCoinRate } = farmData.marketStats;

  if (!flowerUsdPrice && !bestCoinRate) return null;

  return (
    <div className="hidden md:flex bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1.5 items-center gap-4 text-sm font-medium shadow-lg backdrop-blur-md z-20 whitespace-nowrap">
      {flowerUsdPrice && (
        <div className="flex items-center gap-1.5" title="FLOWER Price (USD)">
          <img src={FLOWER_IMG} alt="FLOWER" className="w-5 h-5 object-contain drop-shadow-sm" />
          <span className="text-slate-200">{flowerUsdPrice.toFixed(4)}</span>
        </div>
      )}
      
      {bestCoinRate && (
        <div className="flex items-center gap-1.5" title="Best Crop to Coin Rate">
          <img src={COIN_IMG} alt="Coin" className="w-5 h-5 object-contain drop-shadow-sm" />
          <span className="text-slate-300 border-b border-slate-500 hover:text-white transition-colors cursor-default">
            1:{Math.round(bestCoinRate)}
          </span>
        </div>
      )}
    </div>
  );
};

export default TokenStatsWidget;
