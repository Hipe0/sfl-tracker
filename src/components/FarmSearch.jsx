import { useState, useEffect } from 'react';
import { useFarm } from '../context/FarmContext';
import ProgressRing from './ProgressRing';

const FarmSearch = () => {
  const { handleSearch, loading, currentId, queueInfo, searchSuccess } = useFarm();
  const [farmId, setFarmId] = useState(currentId || localStorage.getItem('sfl_farm_id') || '');

  useEffect(() => {
    if (currentId) setFarmId(currentId);
  }, [currentId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (farmId.trim()) {
      handleSearch(farmId.trim(), true);
    }
  };

  const renderLoadingText = () => {
    if (!queueInfo || !queueInfo.sflCommunity) return 'Đang xử lý...';
    const commWait = queueInfo.sflCommunity.waiting;
    const worldWait = queueInfo.sflWorld ? queueInfo.sflWorld.waiting : 0;
    
    if (commWait === 0 && worldWait === 0) return 'Đang tải dữ liệu...';
    
    // Tính ước lượng thời gian chờ
    const estimatedWait = 6 + (commWait * queueInfo.sflCommunity.delayMs) / 1000;
    return `Xếp hàng (${commWait}) - ~${Math.ceil(estimatedWait)}s`;
  };

  return (
    <div className="glass-card animate-fade-in-up p-4">
      <form onSubmit={handleSubmit} className="w-full flex flex-col md:flex-row gap-3">
        <input 
          type="text" 
          value={farmId}
          onChange={(e) => setFarmId(e.target.value)}
          placeholder="Farm ID..." 
          className="flex-1 px-4 py-3 bg-slate-900/50 text-white rounded-xl outline-none border border-slate-700 focus:border-blue-500 transition-colors shadow-inner placeholder-slate-500 focus:bg-slate-800/80 font-medium tracking-wide"
          disabled={loading}
        />
        <button 
          type="submit" 
          disabled={loading || !farmId.trim()}
          className="flex-shrink-0 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/20 whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <ProgressRing queueInfo={queueInfo} loading={loading} /> {renderLoadingText()}
            </span>
          ) : searchSuccess ? (
            <span className="flex items-center gap-2 text-green-300">
              <i className="bi bi-check-circle-fill"></i> Hoàn tất!
            </span>
          ) : 'Truy cập'}
        </button>
      </form>
    </div>
  )
};

export default FarmSearch;
