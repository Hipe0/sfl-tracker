import React from 'react';

const TicketCalculator = ({ inventory }) => {
  if (!inventory) return null;
  const hasHat = inventory.hasHat;
  const hasArmor = inventory.hasArmor;
  const hasPants = inventory.hasPants;
  const hasVip = inventory.hasVip;

  const bonus = (hasHat ? 1 : 0) + (hasArmor ? 1 : 0) + (hasPants ? 1 : 0) + (hasVip ? 2 : 0);
  const totalBuff = bonus;

  return (
    <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up mt-2">
      <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${inventory.hasHat ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
        <span className="text-sm">🪖</span> Swamp Lily Hat
      </div>
      <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${inventory.hasArmor ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
        <span className="text-sm">🛡️</span> Swamp Armor
      </div>
      <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${inventory.hasPants ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
        <span className="text-sm">👖</span> Swamp Pants
      </div>
      <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${inventory.hasVip ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
        <span className="text-sm">🌟</span> VIP Access
      </div>
      {totalBuff > 0 && (
        <div className="px-3 py-1.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs font-bold flex items-center gap-1.5 shadow-sm">
          <img src="/shiny_feather.webp" alt="Shiny Feather" className="w-4 h-4 object-contain" />
          +{totalBuff} Shiny Feather Buff
        </div>
      )}
    </div>
  );
};

export default TicketCalculator;
