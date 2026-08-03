import { useState, useEffect } from 'react';
import FarmSearch from './components/FarmSearch';
import TicketCalculator from './components/TicketCalculator';
import SummaryPanel from './components/SummaryPanel';
import DeliveriesPanel from './components/DeliveriesPanel';
import ChoresPanel from './components/ChoresPanel';
import BountiesPanel from './components/BountiesPanel';
import AnimalsPanel from './components/AnimalsPanel';
import SeasonAnalytics from './components/SeasonAnalytics';

function App() {
  const [farmData, setFarmData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentId, setCurrentId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);

  // Auto-fetch if ID exists in LocalStorage
  useEffect(() => {
    const savedId = localStorage.getItem('sfl_farm_id');
    if (savedId) {
      handleSearch(savedId);
    }
  }, []);

  const handleSearch = async (farmId) => {
    setLoading(true);
    setError(null);
    setCurrentId(farmId);
    
    // Save to LocalStorage
    localStorage.setItem('sfl_farm_id', farmId);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/farm/${farmId}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      setFarmData(data.data);
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        setError('Cannot connect to the backend server. Please make sure both frontend and backend are running (use "npm run dev").');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
        {/* Top Right Corner (Update Button & Author Info) */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-50">
          <button 
            onClick={() => currentId && handleSearch(currentId)}
            disabled={!currentId || loading}
            className={`bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg backdrop-blur-md ${(!currentId || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`}></i>
            Cập nhật dữ liệu
          </button>
          
          <a 
            href="https://discord.com/users/huyphan1952" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="bg-slate-800/80 hover:bg-slate-700/90 border border-indigo-500/30 p-2 pr-4 rounded-full flex items-center gap-3 transition-all shadow-lg backdrop-blur-md group hover:scale-105 hover:border-indigo-400/60"
            title="Click to view Discord Profile"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black shadow-inner border-2 border-slate-800">
              G
            </div>
            <div className="text-left leading-tight">
              <div className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors flex items-center gap-1.5">
                <i className="bi bi-person-fill text-indigo-400"></i> Ingame: gaconlontonn
              </div>
              <div className="text-[10px] text-indigo-200 flex items-center gap-1.5 mt-0.5 font-medium">
                <i className="bi bi-hash text-indigo-400"></i> ID: 6279470157500012
              </div>
              <div className="text-[10px] text-indigo-300 flex items-center gap-1.5 mt-0.5 uppercase tracking-wider font-semibold">
                <i className="bi bi-discord"></i> Support: huyphan1952
              </div>
            </div>
          </a>
        </div>

        <header className="mb-10 pt-4 text-center flex flex-col items-center animate-fade-in-up">
          <h1 className="text-5xl font-extrabold mb-3 tracking-tight text-white drop-shadow-md flex items-center justify-center gap-4">
            <span className="text-4xl animate-bounce-slow">🌻</span> 
            SFL <span className="text-gradient-yellow">Tracker</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-xl">
            Optimize your Sunflower Land strategy. Track chores, deliveries, and ticket buffs instantly.
          </p>
        </header>

        {/* Tabs */}
        {farmData && (
          <div className="flex justify-center mb-8">
            <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 inline-flex shadow-lg backdrop-blur-md">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'dashboard' ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
              >
                <i className="bi bi-grid-1x2-fill mr-2"></i>Dashboard
              </button>
              <button 
                onClick={() => { setActiveTab('analytics'); setAnalyticsRefreshKey(k => k + 1); }}
                className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'analytics' ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
              >
                <i className="bi bi-calendar3 mr-2"></i>Season Analytics
              </button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' ? (
          <div className="dashboard-grid">
            
            {/* Column 1: Search, Summary, Deliveries */}
            <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 items-center">
              <FarmSearch onSearch={handleSearch} isLoading={loading} initialId={currentId} />
              {farmData && farmData.inventory && (
                <TicketCalculator inventory={farmData.inventory} />
              )}
            </div>
            
            {error && (
              <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-100 p-4 rounded-xl text-center">
                {error}
              </div>
            )}
            
            {farmData && farmData.summary && (
              <SummaryPanel summary={farmData.summary} />
            )}

            {farmData && farmData.scrapedDeliveries && (
              <DeliveriesPanel 
                deliveries={farmData.scrapedDeliveries} 
                totals={farmData.summary?.deliveryTotals} 
              />
            )}
          </div>

          {/* Column 2: Weekly Chores */}
          <div className="flex flex-col gap-4">
            {farmData && farmData.chores && (
              <ChoresPanel chores={farmData.chores} />
            )}
          </div>

          {/* Column 3: Bounties & Animals */}
          <div className="flex flex-col gap-4">
            {farmData && farmData.bounties && (
              <BountiesPanel bounties={farmData.bounties} />
            )}
            
            {farmData && farmData.animals && (
              <AnimalsPanel animals={farmData.animals} />
            )}
          </div>

        </div>
        ) : (
          farmData && <SeasonAnalytics farmData={farmData} farmId={currentId} refreshKey={analyticsRefreshKey} />
        )}

      </div>
    </div>
  );
}

export default App;
