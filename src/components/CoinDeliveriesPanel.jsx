import React, { useMemo, useState } from 'react';
import { useFarm } from '../context/FarmContext';
import foodRecipes from '../data/foodRecipes.json';
import FoodTooltip from './FoodTooltip';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const CombinedDeliveriesPanel = () => {
  const { farmData } = useFarm();

  const coinDeliveries = farmData?.coinDeliveries;
  const ticketDeliveries = farmData?.scrapedDeliveries;
  const globalConfig = farmData?.globalConfig;

  const coinRate = parseFloat(globalConfig?.coinRate?.replace(/,/g, '') || '1428');
  const [showCompleted, setShowCompleted] = useState(true);

  // Parse and separate data
  const { coinList, sflList, ticketList, stats } = useMemo(() => {
    const s = {
       coins: { reward: 0, cost: 0, profit: 0 },
       sfl: { reward: 0, cost: 0, profit: 0 },
       ticket: { reward: 0, cost: 0, profit: 0 }
    };
    
    const coins = [];
    const sfl = [];
    const tickets = [];

    (coinDeliveries || []).forEach(d => {
      const c = parseFloat(d.totalP2PCost) || 0;
      const rAmount = parseFloat(d.rewardAmount) || 0;
      
      if (d.status === 'claimed') {
        if (d.type === 'coins') {
           const rSfl = rAmount / coinRate;
           s.coins.cost += c;
           s.coins.reward += rAmount;
           s.coins.profit += (rSfl - c);
        } else {
           s.sfl.cost += c;
           s.sfl.reward += rAmount;
           s.sfl.profit += (rAmount - c);
        }
      }

      if (d.type === 'coins') {
         coins.push(d);
      } else {
         sfl.push(d);
      }
    });

    (ticketDeliveries || []).forEach(d => {
      if (d.rewardType === 'Shiny Feather') {
         const c = parseFloat(d.totalP2PCost) || 0;
         const rAmount = parseFloat(d.rewardAmount) || 0;
         
         if (d.status === 'claimed') {
           s.ticket.cost += c;
           s.ticket.reward += rAmount;
           s.ticket.profit -= c; // tickets are just pure cost in SFL
         }
         
         tickets.push({
           ...d,
           type: 'ticket' // normalize type
         });
      }
    });

    return { 
      coinList: coins, 
      sflList: sfl, 
      ticketList: tickets,
      stats: s
    };
  }, [coinDeliveries, ticketDeliveries, coinRate]);

  if (!farmData) return null;

  const formatTime = (ms) => {
    if (!ms || ms <= 0) return '';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${mins}m`;
  };

  const renderCard = (d, type) => {
    const isCompleted = d.status === 'claimed';
    if (!showCompleted && isCompleted) return null;

    let rewardIcon = '';
    let rewardValue = d.rewardAmount;
    if (type === 'coins') rewardIcon = <img src={COIN_IMG} className="w-5 h-5 object-contain drop-shadow-sm" alt="Coins" />;
    else if (type === 'sfl') rewardIcon = <img src="data:image/webp;base64,UklGRmoAAABXRUJQVlA4TF0AAAAvCAACED9AEABhy6QuDwK4sEGYbTR/nQGc1v1GJABhgW6ER47rfpj/APDeVAtiumQ0B2wCsG0rSZ8IhEIohImiO+vfbUT/A/8kprxh5UiPIs4UPng00crilB/wTwIA" alt="Flower" className="w-5 h-5 object-contain drop-shadow-md" />;
    else if (type === 'ticket') rewardIcon = <img src="/shiny_feather.webp" alt="Feather" className="w-5 h-5 object-contain drop-shadow-md" />;

    return (
      <div key={d.id || d.npcName} className={`relative bg-slate-900/50 rounded-xl p-4 border flex flex-col hover:z-50 transition-all ${isCompleted ? 'border-emerald-500/30 opacity-70 bg-emerald-900/10' : 'border-slate-700/50 hover:bg-slate-800/50'}`}>
        {/* NPC Info & Reward */}
        <div className="flex justify-between items-start mb-3 border-b border-slate-700/50 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-full border-2 border-slate-600 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
              <img 
                src={`https://sfl.world/img/plaza/${encodeURIComponent(d.npcName.toLowerCase())}.png`}
                alt={d.npcName}
                className="w-8 h-8 object-contain"
                onError={(e) => { e.target.outerHTML = '<i class="bi bi-person-circle text-2xl text-blue-400"></i>'; }}
              />
            </div>
            <div className="font-bold text-slate-200">{d.npcName}</div>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
            {rewardIcon} <span className="font-black text-white">{rewardValue}</span>
          </div>
        </div>

        {/* Requirements */}
        <div className="flex-1 flex flex-col gap-2 justify-start mb-3">
          {(d.reqItems || []).map((item, i) => {
            const invAmount = item.completed !== undefined ? item.completed : 0;
            
            // Format large numbers
            const displayInv = invAmount > 1000000 ? (invAmount/1000000).toFixed(1) + 'M' : Number.isInteger(invAmount) ? invAmount : parseFloat(invAmount.toFixed(2));
            const isEnough = item.enough !== undefined ? item.enough : invAmount >= item.total;

            return (
              <div 
                key={i} 
                className={`px-3 py-1.5 rounded-full border flex items-center justify-between text-xs shadow-sm hover:z-50 transition-colors ${isEnough ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100' : 'bg-slate-800/80 border-slate-700/80 text-slate-200'}`}
              >
                <div className={`flex items-center gap-2 group relative ${foodRecipes[item.name] ? 'cursor-help' : ''}`}>
                  <div className="w-6 h-6 flex items-center justify-center shrink-0">
                    <img 
                      src={`https://sfl.world/img/delivery/${encodeURIComponent(item.name)}.png`}
                      alt={item.name}
                      className="max-w-full max-h-full object-contain drop-shadow-md"
                      onError={(e) => { e.target.onerror = null; e.target.src = `https://sfl.world/img/items/${encodeURIComponent(item.name)}.png`; }}
                    />
                  </div>
                  <span className={`font-semibold text-[11px] truncate ${foodRecipes[item.name] ? 'border-b border-dashed border-emerald-500/50 pb-0.5' : ''}`}>{item.name}</span>
                  <FoodTooltip foodName={item.name} farmData={farmData} />
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="font-mono font-bold text-[11px] bg-slate-900/40 px-1.5 py-0.5 rounded text-white">
                    {displayInv} <span className="text-slate-500 font-normal">/</span> {item.total}
                  </span>
                  {isEnough && <i className="bi bi-check-circle-fill text-emerald-400 text-sm drop-shadow-sm ml-0.5"></i>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Status & Checkmark */}
        <div className="mt-auto flex flex-col gap-2 relative">
             <div className="w-full flex flex-wrap justify-between items-center text-[10px] font-bold gap-y-2">
               {/* Left side: Status or Checkmark */}
               <div className="flex items-center gap-2">
                 {isCompleted ? (
                   <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                     <span className="font-black text-sm leading-none -mt-0.5">✓</span> Đã Giao
                   </span>
                 ) : (
                   <>
                     {d.canSkip && (
                       <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30 uppercase tracking-wider whitespace-nowrap">
                         Skip Ready
                       </span>
                     )}
                     {d.skipWaitTime > 0 && (
                       <span className="bg-slate-700/50 text-slate-400 px-2 py-1 rounded border border-slate-600/50 flex items-center gap-1 uppercase tracking-wider whitespace-nowrap">
                         <i className="bi bi-clock-history"></i> {formatTime(d.skipWaitTime)}
                       </span>
                     )}
                     {(!d.canSkip && (!d.skipWaitTime || d.skipWaitTime <= 0)) && (
                       <span className="bg-sky-500/20 text-sky-400 px-2 py-1 rounded border border-sky-500/30 uppercase tracking-wider whitespace-nowrap">
                         Active
                       </span>
                     )}
                   </>
                 )}
               </div>
               
               {/* Right side: Show P2P cost or Profit if coin/sfl */}
               {(type === 'coins' || type === 'sfl') && (
                 (() => {
                    const rAmount = parseFloat(d.rewardAmount) || 0;
                    const c = parseFloat(d.totalP2PCost) || 0;
                    const profit = type === 'coins' ? (rAmount / coinRate) - c : rAmount - c;
                    const isProfit = profit >= 0;
                    return (
                      <div className="ml-auto flex flex-wrap sm:flex-nowrap items-center gap-2 justify-end">
                        <span className="text-slate-400 font-mono text-[10px] whitespace-nowrap">
                          Chi phí: {c.toFixed(3)} SFL
                        </span>
                        <span className="text-slate-600 hidden sm:inline">|</span>
                        <span className={`font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'} whitespace-nowrap`}>
                          {isProfit ? 'Lãi:' : 'Lỗ:'} {isProfit ? '+' : ''}{profit.toFixed(3)} SFL
                        </span>
                      </div>
                    );
                 })()
               )}
               {type === 'ticket' && d.totalP2PCost > 0 && (
                 (() => {
                    const rAmount = parseFloat(d.rewardAmount) || 0;
                    const c = parseFloat(d.totalP2PCost) || 0;
                    const costPerTicket = rAmount > 0 ? (c / rAmount).toFixed(3) : 0;
                    return (
                      <div className="ml-auto flex flex-wrap sm:flex-nowrap items-center gap-2 justify-end">
                        <span className="text-slate-400 font-mono text-[10px] whitespace-nowrap">
                          Chi phí: {c.toFixed(2)} SFL
                        </span>
                        <span className="text-slate-600 hidden sm:inline">|</span>
                        <span className="text-indigo-400 font-mono font-bold text-[11px] whitespace-nowrap" title="Chi phí SFL cho mỗi 1 Vé">
                          1 <img src="/shiny_feather.webp" className="w-3 h-3 inline-block -mt-0.5 opacity-90 drop-shadow-sm" /> = {costPerTicket} SFL
                        </span>
                      </div>
                    );
                 })()
               )}
             </div>
        </div>
      </div>
    );
  };

  const renderSection = (list, type, title, icon) => {
    const s = stats[type];
    
    return (
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-sm flex flex-col mb-6 animate-fade-in-up">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900/50 p-4 border-b border-slate-700/50 flex justify-between items-center flex-wrap gap-2 rounded-t-2xl">
          <h3 className="text-lg font-black text-white flex items-center gap-2 drop-shadow-sm">
            {icon} {title}
          </h3>
          <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 ml-auto text-emerald-400">
             {list.filter(d => d.status === 'claimed').length} / {list.length} Đơn
          </span>
        </div>
        
        {list.length > 0 && (
          <div className="bg-slate-900/40 px-4 py-2 border-b border-slate-700/50 flex flex-wrap gap-x-6 gap-y-2 text-xs">
             <div className="flex flex-col">
               <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">
                 Tổng Nhận <span className="normal-case italic opacity-80 ml-1">(Chỉ tính H.thành)</span>
               </span>
               <span className="font-bold text-slate-200">
                 {s.reward > 0 ? (
                   <>
                     {s.reward.toLocaleString(undefined, {maximumFractionDigits: 2})} 
                     {type === 'coins' && <img src={COIN_IMG} className="w-3 h-3 ml-1 inline-block" alt="Coins" />}
                     {type === 'ticket' && <img src="/shiny_feather.webp" className="w-3 h-3 ml-1 inline-block" />}
                     {type === 'sfl' && <img src="data:image/webp;base64,UklGRmoAAABXRUJQVlA4TF0AAAAvCAACED9AEABhy6QuDwK4sEGYbTR/nQGc1v1GJABhgW6ER47rfpj/APDeVAtiumQ0B2wCsG0rSZ8IhEIohImiO+vfbUT/A/8kprxh5UiPIs4UPng00crilB/wTwIA" className="w-3 h-3 ml-1 inline-block" alt="Flower" />}
                   </>
                 ) : '0'}
               </span>
             </div>
             
             <div className="flex flex-col">
               <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Tổng Chi P2P</span>
               <span className="font-bold text-amber-400">
                 {s.cost.toLocaleString(undefined, {maximumFractionDigits: 3})} SFL
               </span>
             </div>
             
             <div className="flex flex-col">
               {type === 'ticket' && (
                 <>
                   <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px] flex items-center gap-1">
                     Trung bình 1 <img src="/shiny_feather.webp" className="w-3 h-3 inline-block -mt-0.5" alt="Feather" />
                   </span>
                   <span className="font-bold text-indigo-400">
                     {s.reward > 0 ? (s.cost / s.reward).toFixed(3) : 0} SFL
                   </span>
                 </>
               )}
               {type === 'coins' && (
                 <>
                   <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Tỷ giá 1 SFL</span>
                   <span className="font-bold text-indigo-400">
                     ≈ {coinRate.toLocaleString()} <img src={COIN_IMG} className="w-3 h-3 inline-block" alt="Coins" />
                   </span>
                 </>
               )}
               {type === 'sfl' && (
                 <>
                   <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Lợi nhuận gộp</span>
                   <span className={`font-bold ${s.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                     {s.profit >= 0 ? '+' : ''}{s.profit.toFixed(3)} SFL
                   </span>
                 </>
               )}
             </div>
          </div>
        )}
        
        <div className="p-5 bg-slate-900/20">
           {list.length === 0 ? (
              <div className="text-center py-6 text-slate-500 italic">Dữ liệu trống hoặc không có đơn hàng nào đang chờ xử lý.</div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {list.map(d => renderCard(d, type))}
              </div>
           )}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-4">
      {/* Header Controls */}
      <div className="bg-slate-800/80 rounded-2xl border border-slate-700/50 shadow-xl p-4 flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-200">📌 Active Orders</h2>
        <button 
          onClick={() => setShowCompleted(!showCompleted)}
          className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg text-xs font-bold flex items-center transition-colors shadow-sm"
        >
          <i className={`bi ${showCompleted ? 'bi-eye-slash' : 'bi-eye'} mr-2`}></i>
          {showCompleted ? 'Ẩn Đơn Hoàn Thành' : 'Hiện Đơn Hoàn Thành'}
        </button>
      </div>

      {renderSection(ticketList, 'ticket', 'Shiny Feathers', <img src="/shiny_feather.webp" className="w-6 h-6 object-contain" />)}
      {renderSection(coinList, 'coins', 'Coins', <img src={COIN_IMG} className="w-6 h-6 object-contain" alt="Coins" />)}
      {renderSection(sflList, 'sfl', 'Flowers', <img src="data:image/webp;base64,UklGRmoAAABXRUJQVlA4TF0AAAAvCAACED9AEABhy6QuDwK4sEGYbTR/nQGc1v1GJABhgW6ER47rfpj/APDeVAtiumQ0B2wCsG0rSZ8IhEIohImiO+vfbUT/A/8kprxh5UiPIs4UPng00crilB/wTwIA" className="w-6 h-6 inline-block drop-shadow-sm" alt="Flower" />)}
    </div>
  );
};

export default CombinedDeliveriesPanel;
