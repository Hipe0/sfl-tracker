import React, { useState, useMemo } from 'react';
import skillsData from '../data/skills.json';

const SkillsPanel = ({ userSkills }) => {
  // Group skills by tree
  const trees = useMemo(() => {
    const groups = {};
    Object.values(skillsData).forEach(skill => {
      if (!groups[skill.tree]) groups[skill.tree] = [];
      groups[skill.tree].push(skill);
    });
    // Sort skills by tier within each tree
    Object.keys(groups).forEach(tree => {
      groups[tree].sort((a, b) => a.tier - b.tier);
    });
    return groups;
  }, []);

  const allCategories = Object.keys(trees).sort();
  const [activeCategory, setActiveCategory] = useState(allCategories[0] || '');

  // Render a single skill card
  const renderSkillCard = (skill) => {
    // Rank logic
    // userSkills[skillName] might be a number representing rank, e.g. 1, 2, 3
    const userRank = userSkills[skill.name] || 0;
    
    // Some skills have effect modifiers (e.g. "+50%", "x0.95")
    // The description usually has the pattern, but we have an array of ranks.
    // E.g. ranks: ["0.95", "0.94", "0.925"]
    // We just render the rank values directly. If ranks is empty, we show a generic checkmark or R1.
    const ranks = skill.ranks && skill.ranks.length > 0 ? skill.ranks : ["Yes"];
    
    return (
      <div key={skill.name} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 relative overflow-hidden group hover:bg-slate-800/60 transition-colors shadow-md">
        <div className="flex justify-between items-start mb-2">
          <div className="font-bold text-white text-sm">{skill.name}</div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">{skill.points} pts</span>
            {userRank > 0 && <span className="text-[10px] text-teal-400 font-bold bg-teal-900/30 px-1.5 py-0.5 rounded border border-teal-800">Rank {userRank}</span>}
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mb-3 min-h-[30px] leading-relaxed">{skill.description}</p>
        
        <div className="flex gap-2">
          {ranks.map((val, idx) => {
            const rankNum = idx + 1;
            const isUnlocked = userRank >= rankNum;
            const isCurrent = userRank === rankNum;
            
            return (
              <div 
                key={idx} 
                className={`flex-1 rounded p-1.5 border flex flex-col justify-center
                  ${isUnlocked ? 'border-teal-700/50 bg-teal-900/10' : 'border-slate-700/30 bg-slate-800/30'}
                  ${isCurrent ? 'ring-1 ring-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.2)]' : ''}
                `}
              >
                <div className={`text-[9px] font-bold mb-0.5 ${isUnlocked ? 'text-teal-500' : 'text-slate-500'}`}>
                  R{rankNum}
                </div>
                <div className={`text-xs font-black ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>
                  {skill.effectKind === 'growthMultiplier' || skill.effectKind === 'cooldownMultiplier' || skill.effectKind === 'sellMultiplier' || skill.effectKind === 'feeMultiplier' || skill.effectKind === 'xpMultiplier'
                    ? (val.toString().includes('x') ? val : `x${val}`)
                    : (val.toString().includes('%') || val.toString().includes('x') || val.toString().includes('+') ? val : `+${val}`)
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!allCategories.length) return null;

  const currentTreeSkills = trees[activeCategory] || [];
  
  // Group current tree skills by tier
  const tiers = {};
  currentTreeSkills.forEach(skill => {
    if (!tiers[skill.tier]) tiers[skill.tier] = [];
    tiers[skill.tier].push(skill);
  });

  return (
    <div className="w-full">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700/50 pb-4">
        {allCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors
              ${activeCategory === cat 
                ? 'bg-teal-900/40 text-teal-300 border-teal-700 shadow-[0_0_10px_rgba(20,184,166,0.1)]' 
                : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-800 hover:text-white'
              }
            `}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tier Sections */}
      <div className="space-y-6">
        {Object.keys(tiers).sort((a, b) => parseInt(a) - parseInt(b)).map(tierLevel => (
          <div key={tierLevel}>
            <h4 className="text-[10px] uppercase text-amber-500 font-black tracking-widest mb-3 flex items-center">
              TIER {tierLevel}
              <div className="ml-3 h-px bg-slate-700/50 flex-1"></div>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tiers[tierLevel].map(skill => renderSkillCard(skill))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillsPanel;
