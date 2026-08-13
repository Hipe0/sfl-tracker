import React from 'react';
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

const FlowerTooltip = ({ flowerName, farmData }) => {
  if (!flowerName || !flowerRecipes[flowerName]) return null;

  let flowerMultiplier = 1;
  const activeSkills = [];
  const activeNFTs = [];
  const gameData = farmData?.gameData || {};
  const skills = gameData.bumpkin?.skills || {};
  const inventory = gameData.inventory || {};
  const wardrobe = gameData.wardrobe || {};
  
  const inventoryCount = Math.floor(parseFloat(inventory[flowerName]) || 0);
  
  if (skills["Blooming Boost"]) {
    const rank = skills["Blooming Boost"];
    let buff = 0;
    if (rank === 1) buff = 10;
    else if (rank === 2) buff = 12.5;
    else if (rank >= 3) buff = 15;
    flowerMultiplier *= (1 - buff/100);
    activeSkills.push({ name: "Blooming Boost", rank, val: `-${buff}%`, img: 'data:image/webp;base64,UklGRpwAAABXRUJQVlA4TJAAAAAvCIACEFegJJIV6kkKEIEQf00A+lsUGaihKLYN6q0/BLCXWhOB1KA0kiTlUF0Qj/bzDwj1ayTItinU/Anu9ADA/z9XrsONuEmaarUzKYq56nYBm1rbsrwHti8FqEk8NuCngJubk0TQBrzfxMqX0xAR/e8BzASDnNDvpWh7umi7u/wY5MRpdvlUavEh1w3YDwc=' });
  }
  
  if (skills["Flower Power"]) {
    const rank = skills["Flower Power"];
    let buff = 0;
    if (rank === 1) buff = 20;
    else if (rank === 2) buff = 30;
    else if (rank >= 3) buff = 40;
    flowerMultiplier *= (1 - buff/100);
    activeSkills.push({ name: "Flower Power", rank, val: `-${buff}%`, img: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAATCAYAAABLN4eXAAAAAXNSR0IArs4c6QAAAaFJREFUKJGdkjFIalEYx39HfNEjClxK4W2PpyREuCWmg5M+eMGbWhzCzR4uLq2tLXeJcmtqaQp0sKnhmhS8wUEwbq2ClxbBKMXknTfoPZ6rd+q/ff97fvf7/t85AiAViUkA02oKvfbyTKsp/KlITN7sZQHIVJAAR5v7aJIA+hmf/vVmL0s0kNAtooGEAhz5TKspMpUaAMulLkZyjardIVu2qNodjOQay6XutEuN4+//hJo3GkioAyJ4MZvNzjM0QpTqfdq9BqbVFCIViUknQ9XuUL4/ZV6FeJFfwW8AnDxe4cp0fv22AHj5Lujw94onNO9/KpPq5ABDI0QhXkTaeQrxIkMjpLYKcPtzG6FfLkCp3lehAbV2R5lKzZ0pU6nR7jVc87d7DZx7VJnCubQM/u1NqvwGdmuEqqfej9QXng86wOTtiXAuDdP3BeD/KsR4IGVwawm7NSL5Z7K5Z/MDALs1wvd0eetsUQBiPJDoqp+9KcC18nmFc2nVaXrGNYnfC/KQ+vl4IHFBu4UdCfDyOvPWV98lwF35QYEL4zmgLh0A+A+20rjmqCvBpQAAAA5lWElmTU0AKgAAAAgAAAAAAAAA0lOTAAAAAElFTkSuQmCC' });
  }
  
  if (inventory["Flower Fox"]) {
    flowerMultiplier *= 0.9;
    activeNFTs.push({ name: "Flower Fox", val: "-10%", img: 'data:image/webp;base64,UklGRhYBAABXRUJQVlA4TAoBAAAvFIAEEG+gKJLUaP/g5EYyVlCABCTkFytKA4CQJFPoJrWFZWT930G9eEpiW5WeJgIxUMi1v6YABVB/MQKBJLDtFwsAABB+LQzvDRLSxma/I8O66g5H9UOsN8Cttm158sS/k+p/N0jnCe4wAano3Wqnco/uQBkpcXd/cJdvmu8fIqL/E4AUgDkFc10BOy6bt2wq9edaKxlX5Kdrb98P9E1yasi5t19GIHxNBsPG8CjJqde9fapnJpnkP/uo5mxysfC/mqNu/3vITZ1phZuD/X1+818rVBZKpcbpD52HVXW4v9/W2aEVZDFfzubfJlKALC42phYXUwCkarExVSNiSFVNjYgDgCW2MC0DJg==' });
  }
  
  if (wardrobe["Flower Crown"]) {
    flowerMultiplier *= 0.5;
    activeNFTs.push({ name: "Flower Crown", val: "-50%", img: 'data:image/webp;base64,UklGRrACAABXRUJQVlA4TKMCAAAvYMAoEJ+gJADQBvVD4NDEoyEBJlfgqSVYDaWRrFZ8JAp6oAQsg6c+WklXUZlo1ESy1XxC+zqSBAYJyEEGCumxQZ/D/AcA+fuvTRqqWcr9z3oHtEMIIgIiDJPMwbnADGKiDM9u9k5X2hgo2rYtJa5QIAa9QST//7Xn3luCRZPXrhXR/wloVnorDsV7bL7VXWflUJ/J7hrrhy/XZI9TKo7xVj/E5BhV4hdgD6gPTY5FvdQOqGO0SLwz6RPjHYyX4gFJxdarjiS9MGlGhYem2HrVVJziGFMkZlq9uik/NPPQNiYvxau2UnwITFJM+mSsLAEZBQ7Dj5h8aIojPCy1sTRJbPWqk8AjJkdovWrpyaV4IPqYsmPUSS+oRBVU8m2W/BiTtjHFJ0yWXroJfexiihl18lJrzChZrQGS1E7xgvqKx6Ar9pAqO6baZzReKlVIWlBLT6bYwUtntqPPdvTFOXbFOT6ZYukJmooPU7EvdnGOR6Ch1BV75vjKdsxghCdMlV3soauc4WUPc+zZFOA9QAmMHcyY7WKfz8zZGuhhhiZ/BOALHXwJKADGvn6Oxi7OoD001RsA9FAAOkpABro4F+/1Fru82rx19w3ZWzXL3pc/IEPlnlO/pJ4QKnG3AWcHDLW7DfC9Z0PtKQKUdL/BKQJk1PU1690AIKPralZ+BCCjrqX5xA0AMtllmk8+AkPMlH9WNt/jdzdUngvDgu+oPU735c3e3r9995Uuox6an7oWYBndNF3NwDLqoVHXAuwQYG3Zg6brKu4HyKjrKx8i4MOAm83Sh0E/CLYPMuqpAWTUPQcnin5As9oN+A0Z9dQAMnpuQEZdS7PmDQEyem5Apvr21mb1W7PC5hOP1i/3mtXngu/eQS7/Nz/gCACnCBwB4Pcajw0A' });
  }

  return (
    <div className="absolute left-0 top-full mt-2 w-max max-w-[500px] bg-slate-900 border border-emerald-500/40 p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] text-xs text-slate-300 pointer-events-none">
      <div className="flex gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="font-bold text-emerald-400 mb-2 border-b border-slate-700 pb-1 flex items-center gap-2">
            <i className="bi bi-lightbulb-fill text-yellow-400"></i> Công thức lai tạo
          </div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-slate-400">Hạt giống:</span>
            <span className="bg-amber-900/40 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold text-[10px] flex items-center gap-1">
              <img src={`https://sfl.world/img/flowers/${encodeURIComponent(flowerRecipes[flowerName].seed)}.webp`} className="w-3 h-3 object-contain" onError={(e) => { e.target.style.display='none'; }} />
              {flowerRecipes[flowerName].seed}
            </span>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-slate-400">Có sẵn:</span>
            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${inventoryCount > 0 ? 'bg-emerald-900/40 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
              {inventoryCount}
            </span>
          </div>
          {flowerRecipes[flowerName].bestRecipeChain ? (
            <>
              <div className="text-slate-400 mb-1.5 text-[10px]">Lai tạo nhanh nhất (Best Recipe):</div>
              <div className="flex flex-col gap-1.5 pl-2 border-l-2 border-slate-700/50 ml-1 mb-2">
                {flowerRecipes[flowerName].bestRecipeChain.map((step, stepIdx) => (
                  <div key={step.name} className="flex items-center gap-2 relative">
                    <div className="absolute -left-[9px] top-1/2 w-2 border-t-2 border-slate-700/50"></div>
                    <span className={`bg-slate-800 border px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1.5 ${stepIdx === flowerRecipes[flowerName].bestRecipeChain.length - 1 ? 'border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.2)]' : 'border-slate-700'}`}>
                      <span className="flex items-center gap-1 pr-1 border-r border-slate-700">
                        <img src={`https://sfl.world/img/flowers/${encodeURIComponent(step.seed)}.webp`} className="w-3 h-3 object-contain" onError={(e) => { e.target.style.display='none'; }} />
                        <span className="text-amber-500 font-mono">{formatFlowerTime(step.days * flowerMultiplier)}</span>
                      </span>
                      
                      <span className="flex items-center gap-1 pr-1 border-r border-slate-700 text-slate-500 font-bold">
                         + 
                         {stepIdx === 0 ? (
                            flowerRecipes[step.name]?.crops?.map(c => (
                               <img key={c} src={`https://sfl.world/img/delivery/${encodeURIComponent(c)}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/flowers/${encodeURIComponent(c)}.png`; }} title={c} />
                            ))
                         ) : (
                            <img src={`https://sfl.world/img/flowers/${encodeURIComponent(flowerRecipes[flowerName].bestRecipeChain[stepIdx - 1].name)}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(flowerRecipes[flowerName].bestRecipeChain[stepIdx - 1].name)}.png`; }} title={flowerRecipes[flowerName].bestRecipeChain[stepIdx - 1].name} />
                         )}
                      </span>
                      
                      <span className="flex items-center gap-1">
                        <i className="bi bi-arrow-right text-slate-500 mx-0.5"></i>
                        <img src={`https://sfl.world/img/delivery/${encodeURIComponent(step.name)}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/flowers/${encodeURIComponent(step.name)}.png`; }} /> {step.name}
                        {inventory[step.name] > 0 ? (
                           <span className="ml-1 px-1 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                             {inventory[step.name]}
                           </span>
                        ) : (
                           <span className="ml-1 px-1 rounded bg-slate-800 text-slate-500 border border-slate-700 text-[9px] font-bold">
                             0
                           </span>
                        )}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-700/50 pt-1 mt-1 flex justify-between items-center text-[10px]">
                 <span className="text-slate-400">Tổng:</span>
                 <span className="font-bold text-emerald-400">
                    {formatFlowerTime(flowerRecipes[flowerName].bestRecipeChain.reduce((sum, s) => sum + s.days, 0) * flowerMultiplier)}
                    {flowerMultiplier < 1 && <span className="text-yellow-400 ml-1 text-[9px] font-normal">(-{(100 - flowerMultiplier * 100).toFixed(1)}%)</span>}
                 </span>
              </div>
            </>
          ) : flowerRecipes[flowerName].crops?.length > 0 ? (
            <>
              <div className="text-slate-400 mb-1.5 text-[10px]">Thời gian gieo hạt:</div>
              <div className="font-bold text-emerald-400 text-[10px] mb-2 flex items-center gap-1 border-b border-slate-700/50 pb-2">
                 <i className="bi bi-lightning-charge text-amber-500"></i>
                 {formatFlowerTime(flowerRecipes[flowerName].baseDays * flowerMultiplier)}
                 {flowerMultiplier < 1 && <span className="text-yellow-400 ml-1 text-[9px] font-normal">(-{(100 - flowerMultiplier * 100).toFixed(1)}%)</span>}
              </div>
              <div className="text-slate-400 mb-1.5 text-[10px]">Trồng trực tiếp kế bên:</div>
              <div className="flex flex-wrap gap-1.5">
                {flowerRecipes[flowerName].crops.map(cb => (
                   <span key={cb} className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                      <img src={`https://sfl.world/img/delivery/${encodeURIComponent(cb)}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/flowers/${encodeURIComponent(cb)}.png`; }} /> {cb}
                   </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-slate-400 mb-1.5 text-[10px]">Thời gian gieo hạt:</div>
              <div className="font-bold text-emerald-400 text-[10px] mb-2 flex items-center gap-1 border-b border-slate-700/50 pb-2">
                 <i className="bi bi-lightning-charge text-amber-500"></i>
                 {formatFlowerTime(flowerRecipes[flowerName].baseDays * flowerMultiplier)}
                 {flowerMultiplier < 1 && <span className="text-yellow-400 ml-1 text-[9px] font-normal">(-{(100 - flowerMultiplier * 100).toFixed(1)}%)</span>}
              </div>
              <div className="text-slate-400 mb-1.5 text-[10px]">Trồng kế bên 1 trong các cây sau:</div>
              <div className="flex flex-wrap gap-1.5">
                {flowerRecipes[flowerName].crossbreeds.map(cb => (
                   <span key={cb} className="bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                      <img src={`https://sfl.world/img/delivery/${encodeURIComponent(cb)}.png`} className="w-3 h-3 object-contain" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/flowers/${encodeURIComponent(cb)}.png`; }} /> {cb}
                   </span>
                ))}
              </div>
            </>
          )}
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
                        <img src={buff.img} alt={buff.name} className="w-4 h-4 object-contain drop-shadow-md" />
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
                        <img src={buff.img} alt={buff.name} className="w-4 h-4 object-contain drop-shadow-md" />
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

export default FlowerTooltip;
