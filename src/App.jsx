import { Suspense, lazy, useState, useRef, useEffect } from 'react';
import { useFarm } from './context/FarmContext';
import FarmSearch from './components/FarmSearch';
import TicketCalculator from './components/TicketCalculator';
import SummaryPanel from './components/SummaryPanel';
import DeliveriesPanel from './components/DeliveriesPanel';
import ChoresPanel from './components/ChoresPanel';
import BountiesPanel from './components/BountiesPanel';
import AnimalsPanel from './components/AnimalsPanel';
import FarmProfileCard from './components/FarmProfileCard';
import FarmSummaryCard from './components/FarmSummaryCard';
import TokenStatsWidget from './components/TokenStatsWidget';

const CoinDeliveriesPanel = lazy(() => import('./components/CoinDeliveriesPanel'));
const SeasonAnalytics = lazy(() => import('./components/SeasonAnalytics'));
const AscensionAgePanel = lazy(() => import('./components/AscensionAgePanel'));
const NpcDailyAnalytics = lazy(() => import('./components/NpcDailyAnalytics'));
const CropCoinsPanel = lazy(() => import('./components/CropCoinsPanel'));
const CraftingCostsPanel = lazy(() => import('./components/CraftingCostsPanel'));
const AuctionsPanel = lazy(() => import('./components/AuctionsPanel'));
const MarketTradesPanel = lazy(() => import('./components/MarketTradesPanel'));
import DonationFooter from './components/DonationFooter';
import ProgressRing from './components/ProgressRing';

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
  const { farmData, loading, error, currentId, activeTab, setActiveTab, setAnalyticsRefreshKey, handleSearch, handleLogout, queueInfo, searchSuccess } = useFarm();
  
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderUpdateText = () => {
    if (!queueInfo || !queueInfo.sflCommunity) return 'Đang xử lý...';
    const commWait = queueInfo.sflCommunity.waiting;
    const worldWait = queueInfo.sflWorld ? queueInfo.sflWorld.waiting : 0;
    
    if (commWait === 0 && worldWait === 0) return 'Đang tải...';
    
    const estimatedWait = 6 + (commWait * queueInfo.sflCommunity.delayMs) / 1000;
    return `Chờ ~${Math.ceil(estimatedWait)}s`;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
        {/* Compact Top Navbar */}
        <div className="flex flex-col lg:flex-row justify-between items-center bg-slate-900/40 p-3 rounded-2xl border border-slate-700/50 mb-6 shadow-lg gap-4 animate-fade-in-up backdrop-blur-sm mt-2">
          
          {/* Left: Logo */}
          <div className="flex items-center gap-3 shrink-0">
             <span className="text-3xl animate-bounce-slow">🌻</span>
             <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-md flex items-baseline gap-1.5">
               SFL <span className="text-gradient-yellow">Tracker</span>
             </h1>
          </div>

          {/* Center: Compact Donation */}
          <div className="flex-1 flex justify-center w-full lg:w-auto overflow-x-auto hide-scrollbar pb-1 lg:pb-0">
             <DonationFooter />
          </div>

          {/* Right: Controls */}
          <div className="flex flex-wrap justify-center items-center gap-2 shrink-0">
            {farmData && (
              <button 
                onClick={handleLogout}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:scale-105"
                title="Đăng xuất"
              >
                <i className="bi bi-box-arrow-right"></i> Logout
              </button>
            )}
            <div className="flex flex-col items-center gap-1">
              <button 
                onClick={() => currentId && handleSearch(currentId, true)}
                disabled={!currentId || loading}
                className={`bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${(!currentId || loading) ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
              >
                {loading ? (
                  <>
                    <ProgressRing queueInfo={queueInfo} loading={loading} />
                    {renderUpdateText()}
                  </>
                ) : searchSuccess ? (
                  <>
                    <i className="bi bi-check-circle-fill text-green-300"></i>
                    <span className="text-green-300">Hoàn tất!</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-clockwise"></i>
                    Cập nhật
                  </>
                )}
              </button>
              <span className="text-[9px] text-slate-400/80 leading-tight text-center max-w-[120px]">
                Wait 1-2 mins after tasks to sync.
              </span>
            </div>
            
            <a 
              href="https://discord.com/users/huyphan1952" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-slate-800/80 hover:bg-slate-700/90 border border-indigo-500/30 px-2 py-1 rounded-lg flex items-center gap-2 transition-all shadow-sm group hover:border-indigo-400/60"
              title="Liên hệ cho tôi qua Discord"
            >
              <img 
                src="https://animations.sunflower-land.com/bumpkin_image/0_v1_32_90_52_282_234_89_240_424_0_228_0_562_0_374_0_0_559/100" 
                alt="Avatar" 
                className="w-6 h-6 rounded-md bg-slate-900 object-cover border border-slate-700" 
              />
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-[10px] font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                  gaconlontonn
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* Tabs */}
        {farmData && (
          <div className="flex flex-col lg:flex-row justify-center lg:justify-between items-center mb-8 max-w-[1400px] mx-auto w-full relative">
            <div className="hidden lg:block flex-1"></div>
            
            <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 inline-flex shadow-lg backdrop-blur-md overflow-x-auto max-w-full hide-scrollbar shrink-0 z-10">
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
              </div>
  
              <div className="flex-1 flex justify-end w-full lg:w-auto mt-4 lg:mt-0 items-center gap-3">
                <div className="relative" ref={moreMenuRef}>
                  <button 
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className={`px-4 py-1.5 whitespace-nowrap rounded-lg font-semibold text-sm transition-all duration-200 flex items-center ${['auctions', 'ascension_age', 'crop_coins', 'crafting_costs', 'market_trades'].includes(activeTab) ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30' : 'bg-slate-800/80 text-slate-300 border border-slate-700/50 hover:bg-slate-700 hover:text-white shadow-sm'}`}
                  >
                    <i className="bi bi-grid mr-2"></i>More
                    <span className={`ml-2 transition-transform duration-200 inline-block text-[10px] ${isMoreMenuOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {isMoreMenuOpen && (
                    <div className="absolute top-full mt-2 right-0 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-2 min-w-[200px] z-50 animate-fade-in-up">
                      <button
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${activeTab === 'farm_profile' ? 'bg-indigo-500/20 text-indigo-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                        onClick={() => { setActiveTab('farm_profile'); setIsMoreMenuOpen(false); }}
                      >
                        <div className="flex items-center">
                          <i className="bi bi-person-vcard mr-3"></i> Hồ sơ Farm
                        </div>
                        <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.5 rounded font-normal">beta</span>
                      </button>
                      <button 
                        onClick={() => { setActiveTab('market_trades'); setIsMoreMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center ${activeTab === 'market_trades' ? 'text-amber-400 bg-slate-700/50' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                      >
                        <i className="bi bi-arrow-left-right mr-3"></i>Lịch sử Giao Dịch
                      </button>
                      <button 
                        onClick={() => { setActiveTab('auctions'); setIsMoreMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center ${activeTab === 'auctions' ? 'text-amber-400 bg-slate-700/50' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                      >
                        <i className="bi bi-calendar-event mr-3"></i>Live Auctions
                      </button>
                      <button 
                        onClick={() => { setActiveTab('ascension_age'); setIsMoreMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center ${activeTab === 'ascension_age' ? 'text-amber-400 bg-slate-700/50' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                      >
                        <i className="bi bi-stars mr-3"></i>Chapter 15
                      </button>
                      <button 
                        onClick={() => { setActiveTab('crop_coins'); setIsMoreMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center ${activeTab === 'crop_coins' ? 'text-amber-400 bg-slate-700/50' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                      >
                        <i className="bi bi-cart3 mr-3"></i>Crop to Coin
                      </button>
                      <button 
                        onClick={() => { setActiveTab('crafting_costs'); setIsMoreMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center ${activeTab === 'crafting_costs' ? 'text-amber-400 bg-slate-700/50' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'}`}
                      >
                        <i className="bi bi-hammer mr-3"></i>Crafting Costs
                      </button>
                    </div>
                  )}
                </div>
                <TokenStatsWidget />
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
                <h3 className="text-lg font-bold text-emerald-400 mb-3">Truy Cập Mọi Farm</h3>
                <p className="text-sm text-slate-400 leading-relaxed">Sử dụng với mọi Farm ID. Bất kỳ ai cũng có thể dùng công cụ để theo dõi tiến độ và tối ưu hoá lợi nhuận.</p>
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
              <FarmSummaryCard />
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
          <Suspense fallback={<LoadingSpinner />}>
            <div className="tab-enter flex flex-col gap-6">
              <SeasonAnalytics />
              <NpcDailyAnalytics />
            </div>
          </Suspense>
        )}
        
        {activeTab === 'ascension_age' && (
          <Suspense fallback={<LoadingSpinner />}><div className="tab-enter"><AscensionAgePanel /></div></Suspense>
        )}

        {activeTab === 'crop_coins' && (
          <Suspense fallback={<LoadingSpinner />}><div className="tab-enter"><CropCoinsPanel /></div></Suspense>
        )}

        {activeTab === 'crafting_costs' && (
          <Suspense fallback={<LoadingSpinner />}><div className="tab-enter"><CraftingCostsPanel /></div></Suspense>
        )}

        {activeTab === 'auctions' && (
          <Suspense fallback={<LoadingSpinner />}><div className="tab-enter"><AuctionsPanel /></div></Suspense>
        )}

        {activeTab === 'farm_profile' && (
          <div className="tab-enter">
            <FarmProfileCard />
          </div>
        )}

        {activeTab === 'market_trades' && (
          <Suspense fallback={<LoadingSpinner />}><div className="tab-enter"><MarketTradesPanel /></div></Suspense>
        )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
