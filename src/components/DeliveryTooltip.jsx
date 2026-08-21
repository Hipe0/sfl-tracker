import React from 'react';
import foodRecipes from '../data/foodRecipes.json';
import toolPrices from '../data/toolPrices.json';
import dollRecipes from '../data/dollRecipes.json';
import seedPrices from '../data/seedPrices.json';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const getRecipeIngredients = (itemName) => {
    if (foodRecipes[itemName] && foodRecipes[itemName].ingredients) {
        return foodRecipes[itemName].ingredients;
    }
    if (toolPrices[itemName]) {
        const ing = { ...toolPrices[itemName].ingredients };
        if (toolPrices[itemName].coins > 0) {
            ing["Coins"] = toolPrices[itemName].coins;
        }
        return ing;
    }
    if (dollRecipes[itemName]) {
        if (Array.isArray(dollRecipes[itemName])) {
            const ing = {};
            for (const item of dollRecipes[itemName]) {
                if (!item) continue;
                ing[item] = (ing[item] || 0) + 1;
            }
            return ing;
        } else if (dollRecipes[itemName].ingredients) {
            return dollRecipes[itemName].ingredients;
        }
    }
    
    // We do NOT break down crops/fruits into seeds here for Deliveries,
    // because deliveries cost the item itself, not the seeds.
    return null;
};

const getUnitCost = (itemName, farmData) => {
    if (itemName.toLowerCase() === 'coins') {
        const rate = farmData?.globalConfig?.coinRate ? parseFloat(farmData.globalConfig.coinRate.toString().replace(/,/g, '')) : 1428;
        return { unitCost: 1 / rate, isP2P: false };
    }
    
    // 1. Check P2P market price first
    if (farmData?.prices?.[itemName] > 0) return { unitCost: farmData.prices[itemName] * 0.9, isP2P: true };
    const singular = itemName.endsWith('s') ? itemName.slice(0, -1) : itemName;
    if (farmData?.prices?.[singular] > 0) return { unitCost: farmData.prices[singular] * 0.9, isP2P: true };

    // 2. Fallback to Computed Cost (Crafting)
    if (farmData?.computedCosts?.[itemName] > 0) return { unitCost: farmData.computedCosts[itemName], isP2P: false };
    if (farmData?.computedCosts?.[singular] > 0) return { unitCost: farmData.computedCosts[singular], isP2P: false };
    
    return { unitCost: 0, isP2P: false };
};

const IngredientTree = ({ name, quantity, level, farmData }) => {
    const { unitCost } = getUnitCost(name, farmData);
    const totalCost = unitCost * quantity;
    
    // Always get ingredients if available, even if it has a P2P price.
    // The user requested to see what the item is crafted from.
    const ingredients = getRecipeIngredients(name);
    
    const indentWidth = level * 12;
    
    return (
        <div className="flex flex-col w-full">
            <div className={`flex justify-between items-center text-[10px] ${level === 0 ? 'mt-1' : 'mt-0.5'}`}>
                <span className="flex items-center gap-1.5" style={{ paddingLeft: `${indentWidth}px` }}>
                    {level > 0 && <span className="border-l-2 border-b-2 border-slate-700/50 w-2 h-3 -mt-2 inline-block"></span>}
                    {name === 'Coins' ? (
                        <img src={COIN_IMG} className={`object-contain ${level === 0 ? 'w-4 h-4' : 'w-3 h-3 grayscale opacity-70'}`} alt="Coins" />
                    ) : (
                        <img src={`https://sfl.world/img/items/${encodeURIComponent(name)}.png`} className={`object-contain ${level === 0 ? 'w-4 h-4 drop-shadow-md' : 'w-3 h-3 grayscale opacity-70 drop-shadow-sm'}`} alt={name} onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-circle-fill text-[8px] opacity-50"></i>'; }} />
                    )}
                    <span className={level === 0 ? 'text-slate-200 font-bold' : 'text-slate-400'}>
                        {name} <span className="text-emerald-400/80">x {Number.isInteger(quantity) ? quantity : quantity.toFixed(2)}</span>
                    </span>
                </span>
                <span className={level === 0 ? 'text-slate-300 font-semibold' : 'text-slate-500'}>
                    {totalCost > 0 ? `${totalCost.toFixed(5)}` : '0'} SFL
                </span>
            </div>
            
            {ingredients && Object.keys(ingredients).length > 0 && (
                <div className="flex flex-col">
                    {Object.entries(ingredients).map(([ingName, ingQty]) => (
                        <IngredientTree key={ingName} name={ingName} quantity={ingQty * quantity} level={level + 1} farmData={farmData} />
                    ))}
                </div>
            )}
        </div>
    );
};

const DeliveryTooltip = ({ delivery, farmData }) => {
    if (!delivery || !delivery.reqItems) return null;

    let grandTotal = 0;
    
    const renderedItems = delivery.reqItems.map((item, idx) => {
        const { unitCost } = getUnitCost(item.name, farmData);
        const itemTotal = unitCost * item.total;
        grandTotal += itemTotal;
        
        return (
            <div key={idx} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2 text-xs flex flex-col hover:bg-slate-800/60 transition-colors">
                {/* Breakdown Tree */}
                <IngredientTree name={item.name} quantity={item.total} level={0} farmData={farmData} />
                
                {/* Subtotal line */}
                <div className="flex justify-between items-center text-[10px] mt-1.5 pt-1.5 border-t border-slate-700/30 border-dashed">
                    <span className="text-slate-400">
                        UNIT PRICE: <span className="text-slate-300">{unitCost > 0 ? unitCost.toFixed(5) : '0'} SFL</span>
                    </span>
                    <span className="text-amber-300 font-semibold">
                        = {itemTotal > 0 ? itemTotal.toFixed(5) : '0'} SFL
                    </span>
                </div>
            </div>
        );
    });

    const avgCost = delivery.rewardAmount > 0 ? (grandTotal / delivery.rewardAmount).toFixed(5) : '0';

    return (
        <div className="absolute left-0 top-full mt-2 w-80 p-3 bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl z-[99999] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 pointer-events-none backdrop-blur-sm cursor-default">
            
            {/* Header */}
            <div className="text-emerald-400 font-bold mb-3 border-b border-slate-700/50 pb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 uppercase">
                    <img src={`https://sfl.world/img/plaza/${encodeURIComponent(delivery.npcName.toLowerCase())}.png`} className="w-5 h-5 object-contain" alt={delivery.npcName} onError={(e) => { e.target.onerror = null; e.target.outerHTML = '<i class="bi bi-person-circle text-blue-400"></i>'; }} />
                    {delivery.npcName}'s Order
                </span>
                <span className="text-amber-400 font-bold text-[10px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-inner">
                    Reward: {delivery.rewardAmount}
                    {delivery.rewardType === 'Shiny Feather' && <img src="/shiny_feather.webp" className="w-3 h-3 object-contain inline-block drop-shadow-sm" />}
                    {delivery.rewardType === 'Coins' && <img src={COIN_IMG} className="w-3 h-3 object-contain inline-block drop-shadow-sm" />}
                    {delivery.rewardType === 'Gem' && <span className="text-purple-400">💎</span>}
                </span>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-2">
                <div className="text-slate-400 text-[10px] uppercase font-bold mb-0.5 ml-1">ORDER REQUIREMENTS:</div>
                {renderedItems}
            </div>

            {/* Footer */}
            <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-sm font-bold bg-slate-800/80 p-2 rounded-lg border border-amber-500/30 shadow-inner">
                    <span className="text-slate-300 text-xs">GRAND TOTAL:</span>
                    <span className="text-amber-400 flex items-center gap-1.5">
                        🌸 {grandTotal > 0 ? grandTotal.toFixed(5) : '0'} SFL
                    </span>
                </div>
                {delivery.rewardType === 'Shiny Feather' && (
                    <div className="flex justify-end text-[10px] text-indigo-300 pr-1">
                        1 🪶 = {avgCost} SFL
                    </div>
                )}
            </div>
            
        </div>
    );
};

export default DeliveryTooltip;
