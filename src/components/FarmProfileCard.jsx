import React from 'react';
import { useFarm } from '../context/FarmContext';

const FarmProfileCard = () => {
  const { farmData, currentId } = useFarm();

  if (!farmData) return null;

  const bumpkin = farmData.globalConfig?.bumpkin;
  const playerName = farmData.globalConfig?.playerName || `Bumpkin #${currentId}`;
  const faction = farmData.gameData?.faction?.name;

  return (
    <div className="glass-card animate-fade-in-up w-full overflow-hidden relative group">
      {/* Background Banner */}
      <div className="h-24 bg-gradient-to-r from-blue-900/60 via-indigo-900/60 to-purple-900/60 absolute top-0 left-0 right-0 border-b border-slate-700/50"></div>
      
      <div className="p-5 pt-6 relative z-10 flex flex-col items-center">
        {/* Avatar */}
        <div className="relative mb-3 group-hover:scale-105 transition-transform duration-300">
          <div className="absolute inset-0 bg-indigo-500 rounded-full blur opacity-30 group-hover:opacity-60 transition-opacity"></div>
          <img 
            src={bumpkin?.avatar || "https://animations.sunflower-land.com/bumpkin_image/0_v1_32_90_52_282_234_89_240_424_0_228_0_562_0_374_0_0_559/100"} 
            alt="Bumpkin Avatar" 
            className="w-24 h-24 rounded-full bg-slate-900 object-contain p-1 shadow-2xl border-4 border-slate-800 relative z-10" 
          />
          {bumpkin?.level && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-0.5 rounded-full text-xs font-bold shadow-lg border border-indigo-300/30 whitespace-nowrap z-20">
              Lv. {bumpkin.level}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="text-center mt-2">
          <h2 className="text-xl font-bold text-white mb-1 drop-shadow-md">{playerName}</h2>
          <div className="text-sm text-indigo-200 font-medium mb-3 bg-slate-900/50 inline-block px-3 py-1 rounded-lg border border-slate-700/50">
            <i className="bi bi-hash text-indigo-400"></i> {currentId}
          </div>

          <div className="flex gap-4 justify-center w-full">
            {bumpkin?.experience && (
              <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 flex-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Kinh nghiệm</span>
                <span className="text-amber-400 font-bold text-sm">
                  {bumpkin.experience.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
              </div>
            )}
            
            {faction && (
              <div className="flex flex-col items-center p-2 bg-slate-800/50 rounded-xl border border-slate-700/50 flex-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Phe phái</span>
                <span className="text-emerald-400 font-bold text-sm capitalize">
                  {faction}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmProfileCard;
