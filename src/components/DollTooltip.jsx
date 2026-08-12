import React from 'react';
import dollRecipes from '../data/dollRecipes.json';
import flowerRecipes from '../data/flowerRecipes.json';

const formatFlowerTime = (days) => {
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
   return `${m}m`;
};

const DollTooltip = ({ dollName, farmData }) => {
  if (!dollName || !dollRecipes[dollName]) return null;

  const recipeGrid = dollRecipes[dollName];
  const gameData = farmData?.gameData || {};
  const inventory = gameData.inventory || {};
  const skills = gameData.bumpkin?.skills || {};
  const wardrobe = gameData.wardrobe || {};

  let flowerMultiplier = 1;
  if (skills["Blooming Boost"]) {
    const rank = skills["Blooming Boost"];
    let buff = 0;
    if (rank === 1) buff = 10;
    else if (rank === 2) buff = 12.5;
    else if (rank >= 3) buff = 15;
    flowerMultiplier *= (1 - buff/100);
  }
  if (skills["Flower Power"]) {
    const rank = skills["Flower Power"];
    let buff = 0;
    if (rank === 1) buff = 20;
    else if (rank === 2) buff = 30;
    else if (rank >= 3) buff = 40;
    flowerMultiplier *= (1 - buff/100);
  }
  if (inventory["Flower Fox"]) flowerMultiplier *= 0.9;
  if (wardrobe["Flower Crown"]) flowerMultiplier *= 0.5;

  const uniqueItems = [...new Set(recipeGrid.filter(Boolean))];
  const requiredFlowers = uniqueItems.filter(item => flowerRecipes[item]);

  return (
    <div className="absolute left-0 top-full mt-2 w-max bg-slate-900 border border-emerald-500/40 p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] text-xs text-slate-300 pointer-events-none">
      <div className="flex flex-col gap-3">
        <div>
          <div className="font-bold text-emerald-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
            <i className="bi bi-box-seam text-yellow-400"></i> Công thức chế tạo (Crafting Box)
          </div>
          
          <div className="bg-slate-800 p-2 rounded-lg border border-slate-700/50 inline-block self-start">
            <div className="grid grid-cols-3 gap-1">
              {recipeGrid.map((item, idx) => (
                <div key={idx} className="w-10 h-10 bg-slate-900/80 border border-slate-700/50 rounded flex items-center justify-center relative">
                  {item && (
                    <>
                      <img 
                        src={`https://sfl.world/img/delivery/${encodeURIComponent(item)}.png`} 
                        className="w-6 h-6 object-contain" 
                        alt={item}
                        onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/items/${encodeURIComponent(item)}.png`; }} 
                      />
                      <div className="absolute -top-1 -right-1 bg-slate-800 border border-slate-600 text-[8px] px-1 rounded-full text-slate-300">
                         {Math.floor(parseFloat(inventory[item]) || 0)}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {requiredFlowers.length > 0 && (
          <div className="border-t border-slate-700/50 pt-2 w-full min-w-[220px]">
            <div className="font-bold text-amber-400 mb-2 flex items-center gap-2 text-[10px]">
              <i className="bi bi-flower1"></i> Công thức hoa
            </div>
            <div className="flex flex-col gap-2">
              {requiredFlowers.map(flower => {
                const recipe = flowerRecipes[flower];
                return (
                  <div key={flower} className="bg-slate-800/80 border border-slate-700 p-1.5 rounded flex flex-col gap-1.5">
                    <div className="flex items-center justify-between border-b border-slate-700/50 pb-1">
                      <div className="flex items-center gap-1.5">
                        <img src={`https://sfl.world/img/delivery/${encodeURIComponent(flower)}.png`} className="w-4 h-4 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/flowers/${encodeURIComponent(flower)}.png`; }} />
                        <span className="font-bold text-emerald-300 text-[10px] whitespace-nowrap">{flower}</span>
                      </div>
                      <span className={`px-1 rounded text-[9px] font-bold ${inventory[flower] > 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                        {Math.floor(parseFloat(inventory[flower]) || 0)}
                      </span>
                    </div>
                    {recipe.bestRecipeChain ? (
                      <div className="flex flex-col gap-1 pl-1 border-l-2 border-slate-700/50 ml-1">
                        {recipe.bestRecipeChain.map((step, idx) => (
                          <div key={step.name} className="flex items-center justify-between text-[10px] relative">
                            <div className="flex items-center gap-1.5">
                              <div className="absolute -left-[5px] top-1/2 w-1 border-t-2 border-slate-700/50"></div>
                              <img src={`https://sfl.world/img/flowers/${encodeURIComponent(step.seed)}.webp`} className="w-3 h-3 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                              <span className="text-amber-500 font-mono min-w-[32px] text-left whitespace-nowrap">{formatFlowerTime(step.days * flowerMultiplier)}</span>
                              <img src={`https://sfl.world/img/delivery/${encodeURIComponent(step.name)}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/flowers/${encodeURIComponent(step.name)}.png`; }} />
                              <span className="text-slate-300 whitespace-nowrap">{step.name}</span>
                            </div>
                            <span className={`ml-2 px-1 rounded text-[9px] font-bold ${inventory[step.name] > 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                               {Math.floor(parseFloat(inventory[step.name]) || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic pl-1 flex items-center gap-1 whitespace-nowrap">
                         <img src={`https://sfl.world/img/flowers/${encodeURIComponent(recipe.seed)}.webp`} className="w-3 h-3 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                         Gieo hạt: {formatFlowerTime(recipe.baseDays * flowerMultiplier)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DollTooltip;
