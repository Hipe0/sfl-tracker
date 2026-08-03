import { useState, useEffect } from 'react';

const FarmSearch = ({ onSearch, isLoading, initialId }) => {
  const [farmId, setFarmId] = useState(initialId || localStorage.getItem('sfl_farm_id') || '');

  useEffect(() => {
    if (initialId) setFarmId(initialId);
  }, [initialId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (farmId.trim()) {
      onSearch(farmId.trim());
    }
  };

  return (
    <div className="glass-card animate-fade-in-up">
      <form onSubmit={handleSubmit} className="w-full flex gap-3">
        <input 
          type="text" 
          value={farmId}
          onChange={(e) => setFarmId(e.target.value)}
          placeholder="Enter your Farm ID..." 
          className="flex-1 px-4 py-3 bg-slate-900/50 text-white rounded-xl outline-none border border-slate-700 focus:border-blue-500 transition-colors shadow-inner placeholder-slate-500 focus:bg-slate-800/80 font-medium tracking-wide"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={isLoading || !farmId.trim()}
          className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin inline-block">⏳</span> Loading...
            </span>
          ) : 'Search'}
        </button>
      </form>
    </div>
  )
};

export default FarmSearch;
