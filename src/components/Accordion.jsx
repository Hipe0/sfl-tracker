import React, { useState } from 'react';

const Accordion = ({ title, defaultOpen = false, rightContent = null, children, icon = null }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-card bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden mb-3 shadow-lg">
      {/* Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-left border-b border-transparent"
      >
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-slate-700/50 flex items-center justify-center text-teal-400 rounded">
            {icon ? icon : (
              <i className={`bi bi-play-fill transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}></i>
            )}
          </div>
          <span className="text-white font-bold text-md tracking-wide">{title}</span>
        </div>
        {rightContent && (
          <div className="text-slate-400 text-sm">
            {rightContent}
          </div>
        )}
      </button>

      {/* Content */}
      <div 
        className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}
      >
        <div className="p-4 border-t border-slate-700/30">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Accordion;
