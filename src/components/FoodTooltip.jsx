import React from 'react';
import foodRecipes from '../data/foodRecipes.json';

const formatTime = (seconds) => {
   if (!seconds) return '0h';
   const totalHours = seconds / 3600;
   const d = Math.floor(totalHours / 24);
   const h = Math.floor(totalHours % 24);
   
   if (d > 0) {
      if (h > 0) return `${d}d${h}h`;
      return `${d}d`;
   }
   if (h > 0) {
      const m = Math.floor((seconds % 3600) / 60);
      if (m > 0) return `${h}h${m}m`;
      return `${h}h`;
   }
   const m = Math.floor((seconds % 3600) / 60);
   const s = Math.floor(seconds % 60);
   if (m > 0) {
      if (s > 0) return `${m}m${s}s`;
      return `${m}m`;
   }
   return `${s}s`;
};

const FoodTooltip = ({ foodName, farmData }) => {
  if (!foodName || !foodRecipes[foodName]) return null;

  const recipe = foodRecipes[foodName];
  let timeMultiplier = 1;
  let revenueMultiplier = 1;
  const activeSkills = [];
  const activeNFTs = [];
  
  const gameData = farmData?.gameData || {};
  const skills = gameData.bumpkin?.skills || {};
  const inventory = gameData.inventory || {};
  const wardrobe = gameData.wardrobe || {};
  
  const equippedItems = [];
  if (gameData?.bumpkin?.equipped) {
      equippedItems.push(...Object.values(gameData.bumpkin.equipped));
  }
  if (gameData?.farmHands?.bumpkins) {
      for (const hand of Object.values(gameData.farmHands.bumpkins)) {
          if (hand.equipped) {
              equippedItems.push(...Object.values(hand.equipped));
          }
      }
  }
  
  const inventoryCount = Math.floor(parseFloat(inventory[foodName]) || 0);
  
  // 1. Cooking Time Buffs
  if (skills["Fast Feasts"] && (recipe.building === 'Fire Pit' || recipe.building === 'Kitchen')) {
    const rank = skills["Fast Feasts"];
    let buff = 0;
    if (rank === 1) buff = 10;
    else if (rank === 2) buff = 12.5;
    else if (rank >= 3) buff = 15;
    timeMultiplier *= (1 - buff/100);
    activeSkills.push({ name: "Fast Feasts", rank, val: `-${buff}% Time`, img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAOCAYAAADwikbvAAAAAXNSR0IArs4c6QAAAQJJREFUKJGFk7FuwjAQhj+jPkIqpXNSsbFEYsoDsMDWiRegU6d2pXMrUfUhmLrBwp5MKFnYUJ25kZp3cKc7GUPDL1mKrfvO/50vhh7FUer8fdtZ0xdPHKVOVlFZ5ytMdhOCX7sdAOvtBoDH14/eyxQsKusWy5VbLFf67auo7NntCgt0CfzPOmF9kuQaPJA68yw5c1PWTW+pA4D94aiBIeDvy7rh5/dbn9DEUeqe3z4BGI+GGijdnk9neibuyrrhYTLBSM2SwNd4NGS93TCfzk7APEu4u71HJ8ZvROgkzxK1L2DbWXNx3MSJX0YIasNCtZ017y9P7A/Hk3MfBOgd9Gs/xh+LDtOeZ8rn3gAAAABJRU5ErkJggg==' });
  }

  if (skills["Frosted Cakes"] && recipe.building === 'Bakery') {
    const rank = skills["Frosted Cakes"];
    let buff = 0;
    if (rank === 1) buff = 10;
    else if (rank === 2) buff = 12.5;
    else if (rank >= 3) buff = 15;
    timeMultiplier *= (1 - buff/100);
    activeSkills.push({ name: "Frosted Cakes", rank, val: `-${buff}% Time`, img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAMCAYAAAC0qUeeAAAAAXNSR0IArs4c6QAAAPhJREFUKJFjYEACajFO/9VinP6js2GABVmhbTY3lIfKvrVkHyMDAwMDI0zxIjXj/y1m/AyfH/xh4FVggdM1pz4yxN06C1fHsEjN+P//////L1Iz/v+ttOq/pI3d/2+lVf+RxRkYGBgYF6kZ/4+9eYZhsboJg5OoIIOQlRmyMxnWbNzJAJNnYUAD746dQhfC9CBMNzqIvXkGVfHBM3cZ7E2UUSSQwcEzdyGKL0qwMTBEhzMcXLoSp/WPosMZLkqwQUx2EhVk2BcdjlOxk6ggw0WGr5BwLraz/F/4lxun4n7mrwy9h44zwgO72M7yPy7FvYeOMzIwMDAAABpvYmrWP+EpAAAAAElFTkSuQmCC' });
  }
  
  if (inventory["Master Chef's Cleaver"]) {
    timeMultiplier *= 0.85;
    activeNFTs.push({ name: "Master Chef's Cleaver", val: "-15% Time", img: 'https://sfl.world/img/items/Master_Chef%27s_Cleaver.png' });
  }
  
  if (equippedItems.includes("Luna's Hat")) {
    timeMultiplier *= 0.5;
    activeNFTs.push({ name: "Luna's Hat", val: "-50% Time", img: 'https://sfl.world/img/items/Luna%27s_Hat.png' });
  }

  if (inventory["Desert Gnome"]) {
    timeMultiplier *= 0.9;
    activeNFTs.push({ name: "Desert Gnome", val: "-10% Time", img: 'https://sfl.world/img/items/Desert_Gnome.png' });
  }

  // 2. Delivery Revenue Buffs
  if (skills["Nom Nom"]) {
    const rank = skills["Nom Nom"];
    let buff = 0;
    if (rank === 1) buff = 10;
    else if (rank === 2) buff = 30;
    else if (rank >= 3) buff = 50;
    revenueMultiplier *= (1 + buff/100);
    activeSkills.push({ name: "Nom Nom", rank, val: `+${buff}% Profit`, img: 'https://sfl.world/img/items/Nom_Nom.png' });
  }
  
  if (equippedItems.includes("Chef Apron") && foodName.toLowerCase().includes('cake')) {
    revenueMultiplier *= 1.2;
    activeNFTs.push({ name: "Chef Apron", val: "+20% Profit", img: 'https://sfl.world/img/items/Chef_Apron.png' });
  }

  if (equippedItems.includes("Chef Hat") && recipe.building === 'Bakery') {
    revenueMultiplier *= 1.1;
    activeNFTs.push({ name: "Chef Hat", val: "+10% Profit", img: 'https://sfl.world/img/items/Chef_Hat.png' });
  }
  
  return (
    <div className="absolute left-0 top-full mt-2 w-max max-w-[500px] bg-slate-900 border border-amber-500/40 p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] text-xs text-slate-300 pointer-events-none">
      <div className="flex gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
            <i className="bi bi-fire text-orange-500"></i> Nấu Ăn
          </div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-slate-400">Tên món:</span>
            <span className="font-bold text-slate-200 text-sm">
              {foodName}
            </span>
          </div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-slate-400">Nơi nấu:</span>
            <span className="bg-slate-800 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded font-semibold text-[10px] flex items-center gap-1">
              <img src={`https://sfl.world/img/buildings/${encodeURIComponent(recipe.building.toLowerCase().replace(/ /g, '_'))}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.style.display='none'; }} />
              {recipe.building}
            </span>
          </div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-slate-400">Có sẵn:</span>
            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${inventoryCount > 0 ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              {inventoryCount}
            </span>
          </div>
          
          <div className="text-slate-400 mb-1.5 text-[10px] mt-2">Thời gian nấu:</div>
          <div className="font-bold text-emerald-400 text-xs mb-2 flex items-center gap-1 border-b border-slate-700/50 pb-2">
             <i className="bi bi-clock-history text-amber-500"></i>
             {formatTime(recipe.cookingSeconds * timeMultiplier)}
             {timeMultiplier < 1 && <span className="text-yellow-400 ml-1 text-[10px] font-normal">(-{(100 - timeMultiplier * 100).toFixed(1)}%)</span>}
          </div>
          
          <div className="text-slate-400 mb-1.5 text-[10px]">Nguyên liệu:</div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(recipe.ingredients).map(([ingName, qty]) => {
               const invAmt = Math.floor(parseFloat(inventory[ingName]) || 0);
               return (
                 <div key={ingName} className="bg-slate-800/80 border border-slate-700 px-2 py-1 rounded text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                       <img src={`https://sfl.world/img/items/${encodeURIComponent(ingName.toLowerCase().replace(/ /g, '_'))}.png`} className="w-4 h-4 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(ingName)}.png`; }} /> 
                       {ingName}
                    </span>
                    <span className="font-mono">
                       <span className={invAmt >= qty ? 'text-emerald-400' : 'text-red-400'}>{invAmt >= 1000 ? (invAmt/1000).toFixed(1) + 'k' : invAmt}</span>
                       <span className="text-slate-500 mx-0.5">/</span>
                       <span className="text-slate-300">{qty >= 1000 ? (qty/1000).toFixed(1) + 'k' : qty}</span>
                    </span>
                 </div>
               );
            })}
          </div>
        </div>
        
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
                        <img src={buff.img} alt={buff.name} className="w-4 h-4 object-contain drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-star-fill text-yellow-500"></i>'; }} />
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
                        <img src={buff.img} alt={buff.name} className="w-4 h-4 object-contain drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-star-fill text-purple-500"></i>'; }} />
                        <div className="text-[10px] text-slate-300 font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight">{buff.name}</div>
                      </div>
                      <div className="flex justify-end items-center">
                        <span className="text-[10px] font-mono text-emerald-400">{buff.val}</span>
                      </div>
                   </div>
                ))}
              </div>
            </div>
          )}
          
          {activeSkills.length === 0 && activeNFTs.length === 0 && (
             <div>
                <div className="font-bold text-amber-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
                  <i className="bi bi-lightning-charge-fill"></i> Active Buffs
                </div>
                <div className="text-[10px] text-slate-500 italic mt-2">Không có buff nào</div>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodTooltip;
