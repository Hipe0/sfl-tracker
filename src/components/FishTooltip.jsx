import React from 'react';
import fishData from '../data/fishData.json';

const FishTooltip = ({ itemName, inventory }) => {
  const data = fishData[itemName];
  if (!data) return null;

  const getSeasonColor = (season) => {
    switch(season) {
      case 'spring': return 'text-pink-400';
      case 'summer': return 'text-yellow-400';
      case 'autumn': return 'text-orange-400';
      case 'winter': return 'text-cyan-400';
      default: return 'text-slate-400';
    }
  };

  const capitalize = (s) => s && s[0].toUpperCase() + s.slice(1);

  return (
    <div className="absolute left-0 top-full mt-2 w-max min-w-[200px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[99999] pointer-events-none">
      <h4 className="text-sm font-bold text-sky-400 mb-2 border-b border-slate-700/50 pb-1">Thông tin câu cá</h4>
      
      <div className="flex flex-col gap-2">
        <div className="bg-slate-800/80 border border-slate-700 p-2 rounded-lg flex flex-col gap-1.5">
          {/* Mùa vụ */}
          {data.seasons.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-slate-400 text-[10px]">Mùa:</span>
              {data.seasons.map(season => (
                <span key={season} className={`text-[10px] font-bold ${getSeasonColor(season)} flex items-center gap-1`}>
                  <img src={`https://sfl.world/img/calendar/${season}.png`} className="w-3 h-3" onError={(e) => e.target.style.display='none'} />
                  {capitalize(season)}
                </span>
              ))}
            </div>
          )}

          {/* Mồi câu (Bait) */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px]">Cần mồi:</span>
            <span className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px]">
              {data.bait !== 'Unknown' ? (
                <>
                  <img src={`https://sfl.world/img/items/${encodeURIComponent(data.bait)}.webp`} className="w-3 h-3 object-contain drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(data.bait)}.png`; }} /> 
                  <span className="font-semibold text-slate-300">{data.bait}</span>
                  {inventory?.[data.bait] > 0 ? (
                     <span className="ml-1 px-1 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                       {Math.floor(parseFloat(inventory[data.bait]) || 0)}
                     </span>
                  ) : (
                     <span className="ml-1 px-1 rounded bg-slate-800 text-slate-500 border border-slate-700 text-[9px] font-bold">
                       0
                     </span>
                  )}
                </>
              ) : (
                <span className="text-slate-500 italic">Không rõ</span>
              )}
            </span>
          </div>

          {/* Mồi nhử (Chum) */}
          {data.chums && data.chums.length > 0 && (
            <div className="flex items-start gap-1.5 mt-1">
              <span className="text-slate-400 text-[10px] mt-0.5">Thích chum:</span>
              <div className="flex flex-col gap-1">
                {data.chums.map(chum => (
                  <span key={chum} className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1 text-[10px] w-fit">
                    <img src={`https://sfl.world/img/items/${encodeURIComponent(chum)}.webp`} className="w-3 h-3 object-contain drop-shadow-md" onError={(e) => { e.target.onerror = null; e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(chum)}.png`; }} /> 
                    <span className="font-semibold text-slate-300">{chum}</span>
                    {inventory?.[chum] > 0 ? (
                       <span className="ml-1 px-1 rounded bg-emerald-900/50 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                         {Math.floor(parseFloat(inventory[chum]) || 0)}
                       </span>
                    ) : (
                       <span className="ml-1 px-1 rounded bg-slate-800 text-slate-500 border border-slate-700 text-[9px] font-bold">
                         0
                       </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="mt-2 text-xs flex justify-between items-center bg-slate-950/50 p-2 rounded border border-slate-800/50">
        <span className="text-slate-400">Đang có sẵn:</span>
        <span className={`font-bold px-2 py-0.5 rounded ${inventory?.[itemName] > 0 ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
          {Math.floor(parseFloat(inventory?.[itemName]) || 0)}
        </span>
      </div>
    </div>
  );
};

export default FishTooltip;
