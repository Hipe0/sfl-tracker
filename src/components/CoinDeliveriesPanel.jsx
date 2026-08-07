import React, { useMemo, useState } from 'react';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const CombinedDeliveriesPanel = ({ coinDeliveries, ticketDeliveries, globalConfig, inventory }) => {
  const coinRate = parseFloat(globalConfig?.coinRate?.replace(/,/g, '') || '1388');
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
    else if (type === 'sfl') rewardIcon = <img src="data:image/webp;base64,UklGRmoAAABXRUJQVlA4TF0AAAAvCAACED9AEABhy6QuDwK4sEGYbTR/nQGc1v1GJABhgW6ER47rfpj/APDeVAtiumQ0B2wCsG0rSZ8IhEIohImiO+vfbUT/A/8kprxh5UiPIs4UPng00crilB/wTwIA" alt="SFL" className="w-5 h-5 object-contain drop-shadow-md" onError={(e) => { e.target.outerHTML = '<span class="text-yellow-400 drop-shadow-sm text-lg">🌻</span>'; }} />;
    else if (type === 'ticket') rewardIcon = <img src="/shiny_feather.webp" alt="Feather" className="w-5 h-5 object-contain drop-shadow-md" />;

    return (
      <div key={d.id || d.npcName} className={`relative bg-slate-900/50 rounded-xl p-4 border flex flex-col transition-all ${isCompleted ? 'border-emerald-500/30 opacity-70 bg-emerald-900/10' : 'border-slate-700/50 hover:bg-slate-800/50'}`}>
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
            const displayInv = invAmount > 1000000 ? (invAmount/1000000).toFixed(1) + 'M' : invAmount;
            const isEnough = item.enough !== undefined ? item.enough : invAmount >= item.total;

            return (
              <div 
                key={i} 
                className={`px-2 py-1.5 rounded-lg border flex items-center justify-between text-xs font-medium shadow-sm ${isEnough ? 'bg-amber-500/10 border-amber-500/20 text-amber-100' : 'bg-red-500/10 border-red-500/20 text-red-100'}`}
              >
                <div className="flex items-center gap-2">
                  <img 
                    src={`https://sfl.world/img/delivery/${encodeURIComponent(item.name)}.png`}
                    alt={item.name}
                    className="w-4 h-4 object-contain drop-shadow-md"
                    onError={(e) => { e.target.onerror = null; e.target.src = `https://sfl.world/img/items/${encodeURIComponent(item.name)}.png`; }}
                  />
                  <span>{item.name}</span>
                </div>
                <span className="font-bold whitespace-nowrap">
                  {displayInv} <span className="text-slate-500 mx-0.5">/</span> {item.total}
                  {isEnough && <i className="bi bi-check-lg ml-1 text-emerald-400 font-black"></i>}
                </span>
              </div>
            );
          })}
        </div>

        {/* Status & Checkmark */}
        <div className="mt-auto flex flex-col items-center gap-2 relative">
           {isCompleted ? (
             <div className="w-full flex justify-center py-2">
               <div className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-full border-2 border-emerald-500/60 flex items-center justify-center w-10 h-10 shadow-sm">
                  <span className="text-2xl font-black mb-1">✓</span>
               </div>
             </div>
           ) : (
             <div className="w-full flex justify-between items-center text-[10px] font-bold">
               {d.canSkip && (
                 <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30 uppercase tracking-wider">
                   Skip Ready
                 </span>
               )}
               {d.skipWaitTime > 0 && (
                 <span className="bg-slate-700/50 text-slate-400 px-2 py-1 rounded border border-slate-600/50 flex items-center gap-1 uppercase tracking-wider">
                   <i className="bi bi-clock-history"></i> {formatTime(d.skipWaitTime)}
                 </span>
               )}
               {(!d.canSkip && (!d.skipWaitTime || d.skipWaitTime <= 0)) && (
                 <span className="bg-sky-500/20 text-sky-400 px-2 py-1 rounded border border-sky-500/30 uppercase tracking-wider">
                   Active
                 </span>
               )}
               
               {/* Show P2P cost or Profit if coin/sfl */}
               {(type === 'coins' || type === 'sfl') && (
                 (() => {
                    const rAmount = parseFloat(d.rewardAmount) || 0;
                    const c = parseFloat(d.totalP2PCost) || 0;
                    const profit = type === 'coins' ? (rAmount / coinRate) - c : rAmount - c;
                    const isProfit = profit >= 0;
                    return (
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[10px]">
                          Chi phí: {c.toFixed(3)} SFL
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className={`font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
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
                      <div className="ml-auto flex items-center gap-2">
                        <span className="text-slate-400 font-mono text-[10px]">
                          Chi phí: {c.toFixed(2)} SFL
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className="text-indigo-400 font-mono font-bold text-[11px]" title="Chi phí SFL cho mỗi 1 Vé">
                          1 <img src="/shiny_feather.webp" className="w-3 h-3 inline-block -mt-0.5 opacity-90 drop-shadow-sm" /> = {costPerTicket} SFL
                        </span>
                      </div>
                    );
                 })()
               )}
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderSection = (list, type, title, icon) => {
    const s = stats[type];
    
    return (
      <div className="bg-slate-800/60 rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden backdrop-blur-sm flex flex-col mb-6 animate-fade-in-up">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900/50 p-4 border-b border-slate-700/50 flex justify-between items-center flex-wrap gap-2">
          <h3 className="text-lg font-black text-white flex items-center gap-2 drop-shadow-sm">
            {icon} {title}
          </h3>
          <span className="text-xs font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 ml-auto">
             {list.length} Đơn
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
                     {type === 'sfl' && <span className="ml-1 text-[10px]">🌻</span>}
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
             
             <div className="flex flex-col ml-auto text-right">
               {type === 'ticket' && (
                 <>
                   <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Trung bình 1 🪶</span>
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
      {renderSection(sflList, 'sfl', 'Flowers (SFL)', <img src="data:image/webp;base64,UklGRmoAAABXRUJQVlA4TF0AAAAvCAACED9AEABhy6QuDwK4sEGYbTR/nQGc1v1GJABhgW6ER47rfpj/APDeVAtiumQ0B2wCsG0rSZ8IhEIohImiO+vfbUT/A/8kprxh5UiPIs4UPng00crilB/wTwIA" className="w-6 h-6 inline-block" onError={(e) => { e.target.outerHTML = '🌻'; }} />)}
    </div>
  );
};

export default CombinedDeliveriesPanel;
