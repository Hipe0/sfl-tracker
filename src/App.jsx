import { Suspense, lazy } from 'react';
import { useFarm } from './context/FarmContext';
import FarmSearch from './components/FarmSearch';
import TicketCalculator from './components/TicketCalculator';
import SummaryPanel from './components/SummaryPanel';
import DeliveriesPanel from './components/DeliveriesPanel';
import ChoresPanel from './components/ChoresPanel';
import BountiesPanel from './components/BountiesPanel';
import AnimalsPanel from './components/AnimalsPanel';
import FarmProfileCard from './components/FarmProfileCard';

const CoinDeliveriesPanel = lazy(() => import('./components/CoinDeliveriesPanel'));
const SeasonAnalytics = lazy(() => import('./components/SeasonAnalytics'));
const AscensionAgePanel = lazy(() => import('./components/AscensionAgePanel'));
const NpcDailyAnalytics = lazy(() => import('./components/NpcDailyAnalytics'));
import DonationFooter from './components/DonationFooter';

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center p-12 min-h-[300px] glass-panel animate-pulse-soft">
    <div className="relative">
      <span className="text-6xl animate-spin-slow inline-block drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">🌻</span>
    </div>
    <div className="mt-8 text-xl font-bold text-amber-300 drop-shadow-md">Loading...</div>
    <div className="text-sm text-slate-400 mt-2">Loading game data from your farm</div>
  </div>
);

function App() {
  const { farmData, loading, error, currentId, activeTab, setActiveTab, setAnalyticsRefreshKey, handleSearch, handleLogout } = useFarm();

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
        {/* Top Right Corner (Update Button & Author Info) */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-50">
          {farmData && (
            <button 
              onClick={handleLogout}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg backdrop-blur-md hover:scale-105"
            >
              <i className="bi bi-box-arrow-right"></i>
              Đăng xuất
            </button>
          )}
          <button 
            onClick={() => currentId && handleSearch(currentId, true)}
            disabled={!currentId || loading}
            className={`bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg backdrop-blur-md ${(!currentId || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`}></i>
            Update Data
          </button>
          
          <a 
            href="https://discord.com/users/huyphan1952" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="bg-slate-800/80 hover:bg-slate-700/90 border border-indigo-500/30 p-2 pr-4 rounded-full flex items-center gap-3 transition-all shadow-lg backdrop-blur-md group hover:scale-105 hover:border-indigo-400/60"
            title="Click to view Discord Profile"
          >
            <img 
              src="https://animations.sunflower-land.com/bumpkin_image/0_v1_32_90_52_282_234_89_240_424_0_228_0_562_0_374_0_0_559/100" 
              alt="Bumpkin Avatar" 
              className="w-10 h-10 rounded-full bg-slate-900 object-cover shadow-inner border-2 border-slate-800" 
            />
            <div className="text-left leading-tight">
              <div className="text-sm font-bold text-slate-100 group-hover:text-white transition-colors flex items-center gap-1.5">
                <i className="bi bi-person-fill text-indigo-400"></i> Ingame: gaconlontonn
              </div>
              <div className="text-[10px] text-indigo-200 flex items-center gap-1.5 mt-0.5 font-medium">
                <i className="bi bi-hash text-indigo-400"></i> ID: 6279470157500012
              </div>
              <div className="text-[10px] text-indigo-300 flex items-center gap-1.5 mt-0.5 tracking-wider font-semibold hover:text-indigo-200">
                <i className="bi bi-discord"></i> Liên hệ cho tôi qua Discord
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
            <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 inline-flex shadow-lg backdrop-blur-md overflow-x-auto max-w-full hide-scrollbar">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`px-6 py-2 whitespace-nowrap rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'dashboard' ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
              >
                <i className="bi bi-grid-1x2-fill mr-2"></i>Overview
              </button>
              <button 
                onClick={() => { setActiveTab('deliveries'); setAnalyticsRefreshKey(k => k + 1); }}
                className={`px-6 py-2 whitespace-nowrap rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'deliveries' ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
              >
                <i className="bi bi-box-seam mr-2"></i>Deliveries
              </button>
              <button 
                onClick={() => { setActiveTab('analytics'); setAnalyticsRefreshKey(k => k + 1); }}
                className={`px-6 py-2 whitespace-nowrap rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'analytics' ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
              >
                <i className="bi bi-calendar3 mr-2"></i>Season Progress
              </button>
              <button 
                onClick={() => setActiveTab('ascension_age')}
                className={`px-6 py-2 whitespace-nowrap rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${activeTab === 'ascension_age' ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'}`}
              >
                <i className="bi bi-stars mr-2"></i>The Ascension Age
              </button>
            </div>
          </div>
        )}

        {!farmData ? (
          <div className="max-w-5xl mx-auto flex flex-col items-center justify-center pt-8 pb-16 animate-fade-in-up">
            <div className="w-full max-w-3xl mb-16">
               <FarmSearch />
               {error && (
                 <div className="mt-4 bg-red-500 bg-opacity-20 border border-red-500 text-red-100 p-4 rounded-xl text-center">
                   {error}
                 </div>
               )}
            </div>

            {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full px-4">
              <div className="glass-card p-6 rounded-2xl border border-slate-700/50 bg-slate-800/40 text-center hover:bg-slate-800/60 transition-all transform hover:-translate-y-2 duration-300 shadow-lg">
                <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-500/30 shadow-inner">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-lg font-bold text-blue-400 mb-3">Phân Tích Lợi Nhuận</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Tự động bóc tách và tính toán Lãi/Lỗ chính xác đến từng SFL cho mọi đơn giao hàng và nhiệm vụ hằng ngày.</p>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-slate-700/50 bg-slate-800/40 text-center hover:bg-slate-800/60 transition-all transform hover:-translate-y-2 duration-300 shadow-lg">
                <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-purple-500/30 shadow-inner">
                  <span className="text-3xl">🤝</span>
                </div>
                <h3 className="text-lg font-bold text-purple-400 mb-3">Lịch Sử Thân Thiết</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Theo dõi tỷ lệ hoàn thành, số lần từ chối (Skip) và tổng lợi nhuận kiếm được từ từng NPC một cách trực quan.</p>
              </div>
              <div className="glass-card p-6 rounded-2xl border border-slate-700/50 bg-slate-800/40 text-center hover:bg-slate-800/60 transition-all transform hover:-translate-y-2 duration-300 shadow-lg">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-emerald-500/30 shadow-inner">
                  <span className="text-3xl">🛡️</span>
                </div>
                <h3 className="text-lg font-bold text-emerald-400 mb-3">Bảo Mật Tối Đa</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Hệ thống phân quyền Whitelist nghiêm ngặt. Chỉ những Farm ID được cấp phép nội bộ mới có quyền truy xuất dữ liệu.</p>
              </div>
            </div>
            )}
          </div>
        ) : (
          <>
        {activeTab === 'dashboard' ? (
          <div className="dashboard-grid tab-enter">
            
            {/* Column 1: Search, Summary, Deliveries */}
            <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 items-center">
              <FarmProfileCard />
              {farmData && farmData.inventory && (
                <TicketCalculator />
              )}
            </div>
            
            {farmData && farmData.summary && (
              <SummaryPanel />
            )}

            {farmData && farmData.scrapedDeliveries && (
              <DeliveriesPanel />
            )}

          </div>

          {/* Column 2: Weekly Chores */}
          <div className="flex flex-col gap-4">
            {farmData && farmData.chores && (
              <ChoresPanel />
            )}
          </div>

          {/* Column 3: Bounties & Animals */}
          <div className="flex flex-col gap-4">
            {farmData && farmData.bounties && (
              <BountiesPanel />
            )}
            
            {farmData && farmData.animals && (
              <AnimalsPanel />
            )}
          </div>

        </div>
        ) : activeTab === 'deliveries' ? (
          farmData && (
            <Suspense fallback={<LoadingSpinner />}>
              <div className="tab-enter">
                <CoinDeliveriesPanel />
                <NpcDailyAnalytics />
              </div>
            </Suspense>
          )
        ) : null}

        {activeTab === 'analytics' && (
          <Suspense fallback={<LoadingSpinner />}><div className="tab-enter"><SeasonAnalytics /></div></Suspense>
        )}
        
        {activeTab === 'ascension_age' && (
          <Suspense fallback={<LoadingSpinner />}><div className="tab-enter"><AscensionAgePanel /></div></Suspense>
        )}
          </>
        )}
        
        <DonationFooter />
      </div>
    </div>
  );
}

export default App;
