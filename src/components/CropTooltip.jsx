import React from 'react';
import cropRecipes from '../data/cropRecipes.json';
import seedPrices from '../data/seedPrices.json';

const formatCropTime = (days) => {
   if (!days) return '0h';
   const totalHours = days * 24;
   const d = Math.floor(totalHours / 24);
   const h = Math.floor(totalHours % 24);
   
   if (d > 0) {
      if (h > 0) return `${d}d${h}h`;
      return `${d}d`;
   }
   if (h > 0) {
      return `${h}h`;
   }
   const m = Math.round((totalHours % 1) * 60);
   const s = Math.round(((totalHours % 1) * 60 % 1) * 60);
   if (m > 0) return `${m}m`;
   return `${s}s`;
};

const CropTooltip = ({ cropName, farmData, item }) => {
  if (!cropName || !cropRecipes[cropName]) return null;

  let multiplier = 1;
  const activeSkills = [];
  const activeNFTs = [];
  const gameData = farmData?.gameData || {};
  const skills = gameData.bumpkin?.skills || {};
  const inventory = gameData.inventory || {};
  const wardrobe = gameData.wardrobe || {};
  
  const seedName = cropRecipes[cropName].seed;
  const inventoryCount = Math.floor(parseFloat(inventory[seedName]) || 0);
  
  // Crop Skills
  if (skills["Green Thumb"]) {
    const rank = skills["Green Thumb"];
    let buff = 0;
    if (rank === 1) buff = 5;
    else if (rank === 2) buff = 10;
    else if (rank >= 3) buff = 15;
    multiplier *= (1 - buff/100);
    activeSkills.push({ name: "Green Thumb", rank, val: `-${buff}%`, img: 'data:image/webp;base64,UklGRpwAAABXRUJQVlA4TJAAAAAvCIACEFegJJIV6kkKEIEQf00A+lsUGaihKLYN6q0/BLCXWhOB1KA0kiTlUF0Qj/bzDwj1ayTItinU/Anu9ADA/z9XrsONuEmaarUzKYq56nYBm1rbsrwHti8FqEk8NuCngJubk0TQBrzfxMqX0xAR/e8BzASDnNDvpWh7umi7u/wY5MRpdvlUavEh1w3YDwc=' });
  }

  if (skills["Cultivator"]) {
    const rank = skills["Cultivator"];
    let buff = 5; // Assuming Cultivator rank 1 is 5%
    multiplier *= (1 - buff/100);
    activeSkills.push({ name: "Cultivator", rank, val: `-${buff}%`, img: 'https://sfl.world/img/bumpkins/skills/cultivator.png' });
  }

  // Fruit Skills
  if (skills["Apple Tree"]) {
    const rank = skills["Apple Tree"];
    if (cropName === "Apple") {
      let buff = 10;
      multiplier *= (1 - buff/100);
      activeSkills.push({ name: "Apple Tree", rank, val: `-${buff}%`, img: 'https://sfl.world/img/bumpkins/skills/apple_tree.png' });
    }
  }
  
  // NFTs
  if (inventory["Nancy"]) {
    multiplier *= 0.85;
    activeNFTs.push({ name: "Nancy", val: "-15%", img: 'https://sfl.world/img/nfts/nancy.png' });
  }
  if (inventory["Scarecrow"]) {
    multiplier *= 0.85;
    activeNFTs.push({ name: "Scarecrow", val: "-15%", img: 'https://sfl.world/img/nfts/scarecrow.png' });
  }
  if (inventory["Kuebiko"]) {
    multiplier *= 0.85;
    activeNFTs.push({ name: "Kuebiko", val: "-15%", img: 'https://sfl.world/img/nfts/kuebiko.png' });
  }

  return (
    <div className="absolute left-0 top-full mt-2 w-max max-w-[400px] bg-slate-900 border border-emerald-500/40 p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] text-xs text-slate-300 pointer-events-none">
      <div className="flex gap-4">
        <div className="flex-1 min-w-[180px]">
          <div className="font-bold text-emerald-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
            <i className="bi bi-info-circle-fill text-blue-400"></i> Thông tin gieo trồng
          </div>
          
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-slate-400">Hạt giống:</span>
            <span className="bg-amber-900/40 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold text-[10px] flex items-center gap-1">
              <img src={`https://sfl.world/img/delivery/${encodeURIComponent(seedName)}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.style.display='none'; }} />
              {seedName}
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2 border-b border-slate-700/50 pb-2">
            <span className="text-slate-400">Có sẵn:</span>
            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${inventoryCount > 0 ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              {inventoryCount}
            </span>
          </div>
          
          <div className="text-slate-400 mb-1.5 text-[10px]">Thời gian gieo hạt:</div>
          <div className="font-bold text-emerald-400 text-[11px] mb-1 flex items-center gap-1">
             <i className="bi bi-lightning-charge text-amber-500"></i>
             {formatCropTime(cropRecipes[cropName].baseDays * multiplier)}
             {multiplier < 1 && <span className="text-yellow-400 ml-1 text-[9px] font-normal">(-{(100 - multiplier * 100).toFixed(1)}%)</span>}
          </div>

          {item && item.unitCost > 0 && (
            <div className="mt-3 pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Giá / 1 hạt giống:</span>
                <span className="text-[11px] text-yellow-400 font-mono font-bold flex items-center gap-1">
                  <img src="data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=" className="w-3 h-3 object-contain drop-shadow" />
                  {seedPrices[seedName] || 0} Coins
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Tổng chi phí ({item.total}):</span>
                <span className="text-xs text-yellow-400 font-mono font-bold flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  <img src="https://sfl.world/img/Flower.png" className="w-3.5 h-3.5 object-contain drop-shadow" />
                  {Number(item.choreCost).toFixed(5)} SFL
                </span>
              </div>
            </div>
          )}
        </div>
        
        {(activeSkills.length > 0 || activeNFTs.length > 0) && (
          <div className="w-[150px] border-l border-slate-700/50 pl-4 flex flex-col gap-4">
            {activeSkills.length > 0 && (
              <div>
                <div className="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
                  <i className="bi bi-lightning-charge-fill"></i> Skill Buffs
                </div>
                <div className="flex flex-col gap-2">
                  {activeSkills.map(buff => (
                     <div key={buff.name} className="bg-slate-800/80 rounded p-1.5 border border-slate-700 flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                          <img src={buff.img} alt={buff.name} className="w-4 h-4 object-contain drop-shadow-md" onError={(e) => { e.target.style.display='none'; }} />
                          <div className="text-[10px] text-slate-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight">{buff.name}</div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] bg-slate-700 px-1 rounded text-slate-400">r{buff.rank}</span>
                          <span className="text-[10px] font-mono text-emerald-400">{buff.val}</span>
                        </div>
                     </div>
                  ))}
                </div>
              </div>
            )}
            
            {activeNFTs.length > 0 && (
              <div>
                <div className="font-bold text-purple-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
                  <i className="bi bi-box-fill"></i> NFT Buffs
                </div>
                <div className="flex flex-col gap-2">
                  {activeNFTs.map(buff => (
                     <div key={buff.name} className="bg-slate-800/80 rounded p-1.5 border border-slate-700 flex flex-col">
                        <div className="flex items-center gap-1.5 mb-1">
                          <img src={buff.img} alt={buff.name} className="w-4 h-4 object-contain drop-shadow-md" onError={(e) => { e.target.style.display='none'; }} />
                          <div className="text-[10px] text-slate-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight">{buff.name}</div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-mono text-emerald-400">{buff.val}</span>
                        </div>
                     </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CropTooltip;
