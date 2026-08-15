import React from 'react';
import toolPrices from '../data/toolPrices.json';
const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";


const ToolTooltip = ({ toolName, item, farmData }) => {
  const actualToolName = toolName === 'Fishing Rod' ? 'Rod' : toolName;
  if (!actualToolName || !toolPrices[actualToolName]) return null;

  const toolDef = toolPrices[actualToolName];
  let recipeIngredients = { ...toolDef.ingredients };
  if (toolDef.coins > 0) {
    recipeIngredients['Coins'] = toolDef.coins;
  }
  const recipe = {
    building: ['Rod', 'Fishing Rod', 'Crab Pot', 'Mariner Pot'].includes(toolName) ? 'Fisherman' : 'Blacksmith',
    ingredients: recipeIngredients
  };
  
  
  const inventory = farmData?.gameData?.inventory || {};
  const inventoryCount = Math.floor(parseFloat(inventory[toolName]) || 0);
  
  const getToolCost = () => {
    if (item && item.unitCost > 0 && !window.location.pathname.includes('delivery')) return item.unitCost;
    if (farmData?.prices && farmData.prices[toolName] > 0) return farmData.prices[toolName];
    
    let cost = 0;
    if (Object.keys(recipe.ingredients).length > 0) {
      Object.entries(recipe.ingredients).forEach(([ing, qty]) => {
        if (ing === 'Coins') {
          const rate = parseFloat(farmData?.globalConfig?.coinRate?.replace(/,/g, '') || '1428');
          cost += qty / rate;
        } else if (farmData?.prices && farmData.prices[ing]) {
          cost += farmData.prices[ing] * qty;
        }
      });
    }
    return cost;
  };

  const calculatedUnitCost = getToolCost();

  return (
    <div className="absolute left-0 top-full mt-2 w-max min-w-[250px] max-w-[400px] bg-slate-900 border border-emerald-500/40 p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] text-xs text-slate-300 pointer-events-none">
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="font-bold text-emerald-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
            <i className="bi bi-hammer text-slate-400"></i> Công Cụ
          </div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-slate-400">Tên công cụ:</span>
            <span className="font-bold text-slate-200 text-sm">
              {toolName}
            </span>
          </div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-slate-400">Nơi chế tạo:</span>
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
          
          {Object.keys(recipe.ingredients).length > 0 && (
            <>
              <div className="text-slate-400 mb-1.5 text-[10px] mt-2">Nguyên liệu:</div>
              <div className="flex flex-col gap-1.5 mb-3">
                {Object.entries(recipe.ingredients).map(([ingName, qty]) => {
                  const isCoin = ingName === 'Coins';
                  const invAmt = isCoin ? (farmData?.gameData?.coins || 0) : Math.floor(parseFloat(inventory[ingName]) || 0);
                  
                  return (
                    <div key={ingName} className="bg-slate-800/80 border border-slate-700 px-2 py-1 rounded text-[11px] flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          {isCoin ? (
                             <img src={COIN_IMG} className="w-4 h-4 object-contain" alt="Coins" />
                          ) : (
                             <img src={`https://sfl.world/img/items/${encodeURIComponent(ingName.toLowerCase().replace(/ /g, '_'))}.png`} className="w-4 h-4 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(ingName)}.png`; }} /> 
                          )}
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
            </>
          )}

          {calculatedUnitCost > 0 && (
            <div className="mt-3 pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Giá / 1 công cụ:</span>
                <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <img src="https://sfl.world/img/Flower.png" className="w-3 h-3 object-contain drop-shadow" />
                  {Number(calculatedUnitCost).toFixed(5)} SFL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Tổng chi phí ({item?.total || 1}):</span>
                <span className="text-xs text-yellow-400 font-mono font-bold flex items-center gap-1 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                  <img src="https://sfl.world/img/Flower.png" className="w-3.5 h-3.5 object-contain drop-shadow" />
                  {Number(item?.choreCost || (calculatedUnitCost * (item?.total || 1))).toFixed(5)} SFL
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolTooltip;
