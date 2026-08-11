import React from 'react';
import fishingRecipes from '../data/fishingRecipes.json';

const FishingTooltip = ({ itemName, prices, inventory }) => {
  if (!itemName || !fishingRecipes[itemName]) return null;

  const recipes = fishingRecipes[itemName];

  return (
    <div className="absolute left-0 top-full mt-2 w-max max-w-[300px] bg-slate-900 border border-blue-500/40 p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] text-xs text-slate-300 pointer-events-none">
      <div className="font-bold text-blue-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
        <i className="bi bi-droplet-fill text-cyan-400"></i> Công thức đặt bẫy
      </div>
      
      <div className="flex flex-col gap-2">
        {recipes.map((recipe, idx) => {
          return (
            <div key={idx} className="bg-slate-800/80 border border-slate-700 p-2 rounded-lg flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px]">
                  <img src={`https://sunflower-land.com/game-assets/tools/${recipe.pot.toLowerCase().replace(' ', '_')}.webp`} className="w-3 h-3 object-contain drop-shadow-md" onError={(e) => { e.target.style.display = 'none'; }} /> 
                  <span className="font-semibold text-slate-300">{recipe.pot}</span>
                </span>
                <span className="text-slate-500 text-[10px]"><i className="bi bi-plus-lg"></i></span>
                <span className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px]">
                  {recipe.chum !== "None" ? (
                    <>
                      <img src={`https://sfl.world/img/items/${encodeURIComponent(recipe.chum)}.webp`} className="w-3 h-3 object-contain drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(recipe.chum)}.png`; }} /> 
                      <span className="font-semibold text-slate-300">{recipe.chum} <span className="text-amber-500">x{recipe.amount}</span></span>
                      {inventory?.[recipe.chum] > 0 ? (
                         <span className="ml-1 px-1 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                           {inventory[recipe.chum]}
                         </span>
                      ) : (
                         <span className="ml-1 px-1 rounded bg-slate-800 text-slate-500 border border-slate-700 text-[9px] font-bold">
                           0
                         </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500 italic">Không mồi</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] mt-1 border-t border-slate-700/50 pt-1.5">
                 <span className="text-slate-400">Cost P2P:</span>
                 <span className="font-mono text-fuchsia-400 font-bold flex items-center gap-1">
                    <img src="https://sfl.world/img/items/Block Buck.png" className="w-3 h-3" onError={(e) => { e.target.style.display='none'; }} />
                    {recipe.cost.toFixed(2)}
                 </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px]">
        <span className="text-slate-400">Đang có sẵn:</span>
        <span className={`font-bold px-1.5 py-0.5 rounded border ${inventory?.[itemName] > 0 ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
          {inventory?.[itemName] || 0}
        </span>
      </div>
    </div>
  );
};

export default FishingTooltip;
