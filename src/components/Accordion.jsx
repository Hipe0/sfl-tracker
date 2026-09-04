import React, { useState } from 'react';

const Accordion = ({ title, defaultOpen = false, rightContent = null, children, icon = null }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-card bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden mb-3 shadow-lg">
      {/* Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-700/50 transition-colors text-left border-b border-transparent group"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center text-slate-400 group-hover:text-teal-400 transition-colors">
            {icon ? icon : (
              <svg 
                className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-400' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
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
