import React, { useState, useEffect } from 'react';
import { useFarm } from '../context/FarmContext';
import { getChapterForDate, CHAPTER_ORDER } from '../utils/gameConstants';

const getFullUrl = (path, name, assetsMap = {}, apiUrl = '') => {
  if (assetsMap) {
    // 1. Try mapping by visual name
    if (name) {
      let key = name.toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/ /g, '');
      
      if (key === 'flower' || key === 'sfl') key = 'flowertoken';
      
      if (assetsMap[key]) {
        return `${apiUrl}${assetsMap[key]}`;
      }
    }
    
    // 2. Try mapping by path basename (e.g. "./icon/nftw/413.webp" -> "413")
    if (path) {
      const match = path.match(/\/([^/]+)\.[a-zA-Z0-9]+$/);
      if (match && match[1]) {
        const pathKey = match[1].toLowerCase().replace(/_/g, '').replace(/-/g, '').replace(/ /g, '');
        if (assetsMap[pathKey]) {
          return `${apiUrl}${assetsMap[pathKey]}`;
        }
      }
    }
  }

  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('./')) return path.replace('./', 'https://sunflowermanager.xyz/');
  return `https://sunflowermanager.xyz/${path}`;
};

const extractBidValue = (user) => {
  if (!user) return 0;
  if (user.sfl && user.sfl > 0) return user.sfl;
  if (user.tickets && user.tickets > 0) return user.tickets;
  if (user.items && typeof user.items === 'object') {
    const vals = Object.values(user.items);
    if (vals.length > 0) return vals[0];
  }
  if (user.ingredients && typeof user.ingredients === 'object') {
    const vals = Object.values(user.ingredients);
    if (vals.length > 0) return vals[0];
  }
  return 0;
};

const Countdown = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days > 0 ? days + 'd ' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  return <span>{timeLeft}</span>;
};

const AuctionsPanel = () => {
  const { currentId, farmData } = useFarm();
  const [auctionsList, setAuctionsList] = useState([]);
  const [filteredAuctions, setFilteredAuctions] = useState([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState('');
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState(null);

  const [selectedChapter, setSelectedChapter] = useState('Ascension Age');
  const [assetsMap, setAssetsMap] = useState({});
  const activeRowRef = React.useRef(null);

  // Summary State
  const [summaryData, setSummaryData] = useState([]);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // 0. Fetch assets map on mount
  useEffect(() => {
    fetch(`${apiUrl}/api/assets-map`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAssetsMap(data.data);
        }
      })
      .catch(console.error);
  }, [apiUrl]);

  // 1. Fetch list of auctions on mount
  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        setLoadingList(true);
        const token = localStorage.getItem('sfl_token');
        const res = await fetch(`${apiUrl}/api/auctions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Lỗi khi tải danh sách đấu giá');
        
        if (data.success && data.data && data.data.auctions) {
          setAuctionsList(data.data.auctions);
          setFilteredAuctions(data.data.auctions);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingList(false);
      }
    };

    fetchAuctions();
  }, [apiUrl]);

  // Handle Filtering & Auto-scroll
  useEffect(() => {
    let result = [...auctionsList];
    if (selectedChapter && selectedChapter !== 'All') {
      result = result.filter(a => getChapterForDate(a.endAt) === selectedChapter);
    }
    setFilteredAuctions(result);
    
    // Attempt auto-scroll after a short delay to allow DOM to render
    setTimeout(() => {
      if (activeRowRef.current) {
        activeRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, [selectedChapter, auctionsList]);

  // 2. Fetch details when selectedAuctionId changes
  useEffect(() => {
    if (!selectedAuctionId) return;

    const fetchDetails = async () => {
      try {
        setLoadingDetails(true);
        setError(null);
        setLeaderboardData(null);
        
        const token = localStorage.getItem('sfl_token');
        const username = farmData?.username || 'Guest';
        
        const res = await fetch(`${apiUrl}/api/auctions/${encodeURIComponent(selectedAuctionId)}?farmId=${currentId}&username=${encodeURIComponent(username)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.message || 'Lỗi khi tải chi tiết đấu giá');
        
        if (data.success && data.data) {
          setLeaderboardData(data.data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingDetails(false);
      }
    };

    fetchDetails();
  }, [selectedAuctionId, currentId, farmData, apiUrl]);

  // 3. Reset Summary when auction changes
  useEffect(() => {
    setShowSummary(false);
    setSummaryData([]);
    setIsSummaryLoading(false);
  }, [selectedAuctionId]);

  const selectedAuctionInfo = auctionsList.find(a => a.auctionId === selectedAuctionId);

  const fetchSummary = async () => {
    if (!selectedAuctionInfo) return;
    
    // Tìm tất cả các drop của món đồ này và sắp xếp theo thời gian bắt đầu
    const relatedAuctions = [...auctionsList]
      .filter(a => a.itemName === selectedAuctionInfo.itemName)
      .sort((a, b) => a.startAt - b.startAt);
      
    setShowSummary(true);
    setIsSummaryLoading(true);
    setSummaryData(relatedAuctions.map(a => ({ ...a, loading: true, data: null })));
    
    const token = localStorage.getItem('sfl_token');
    const username = farmData?.username || 'Guest';
    
    // Gọi tuần tự từng API để tránh bị chặn, backend đã có queue xử lý Rate Limit
    for (let i = 0; i < relatedAuctions.length; i++) {
      const auc = relatedAuctions[i];
      
      // Bỏ qua không gọi API cho các phiên chưa bắt đầu (Sắp tới)
      if (auc.startAt > Date.now()) {
        setSummaryData(prev => {
          const newData = [...prev];
          newData[i] = { ...newData[i], loading: false, data: null };
          return newData;
        });
        continue;
      }

      try {
        const res = await fetch(`${apiUrl}/api/auctions/${encodeURIComponent(auc.auctionId)}?farmId=${currentId}&username=${encodeURIComponent(username)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        setSummaryData(prev => {
          const newData = [...prev];
          newData[i] = { ...newData[i], loading: false, data: data.success ? data.data : null };
          return newData;
        });
      } catch (e) {
        setSummaryData(prev => {
          const newData = [...prev];
          newData[i] = { ...newData[i], loading: false, data: null };
          return newData;
        });
      }
    }
    
    setIsSummaryLoading(false);
  };

  const formatNumber = (num) => {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 3
    }).format(num);
  };

  const formatXP = (xp) => {
    if (!xp) return '0';
    if (xp >= 1000000) return (xp / 1000000).toFixed(3) + 'M';
    if (xp >= 1000) return (xp / 1000).toFixed(3) + 'K';
    return xp;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up font-sans">
      
      {/* AUCTIONS LIST SECTION */}
      <div className="bg-[#1e130c] border-2 border-[#5c3a21] rounded-xl overflow-hidden shadow-2xl relative">
        {/* Header Options */}
        <div className="bg-[#2a1b12] p-3 border-b-2 border-[#5c3a21] flex flex-col md:flex-row justify-between items-center gap-3">
          <h2 className="text-xl font-bold text-white drop-shadow-md">
            Auctions
          </h2>
          <div className="flex items-center gap-2 text-sm text-amber-100">
            <span>Chapter:</span>
            <select 
              className="bg-white text-black rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              value={selectedChapter}
              onChange={e => setSelectedChapter(e.target.value)}
            >
              <option value="All">All Chapters</option>
              {Object.keys(CHAPTER_ORDER)
                .sort((a, b) => CHAPTER_ORDER[b] - CHAPTER_ORDER[a])
                .map(chapter => (
                  <option key={chapter} value={chapter}>Chapter {CHAPTER_ORDER[chapter]}: {chapter}</option>
              ))}
            </select>
          </div>
        </div>

        {loadingList ? (
          <div className="p-10 text-center text-amber-200/50 animate-pulse font-bold">Đang tải danh sách đấu giá...</div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse whitespace-nowrap text-sm text-amber-50">
              <thead className="sticky top-0 bg-[#1e130c] z-10 shadow-md">
                <tr className="border-b border-[#4a2e1b] font-bold text-white">
                  <th className="p-3">Item</th>
                  <th className="p-3 text-center">Type</th>
                  <th className="p-3 text-center">cur</th>
                  <th className="p-3 text-center">Supply</th>
                  <th className="p-3">End</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3d2616]">
                {filteredAuctions.map((auc) => {
                  // The active/next auction is the first one that hasn't ended yet
                  const isEndingSoon = auc.endAt > Date.now() && (auc.startAt <= Date.now() || auc.startAt > Date.now());
                  const isNext = [...filteredAuctions].reverse().find(a => a.endAt > Date.now())?.auctionId === auc.auctionId;

                  return (
                  <tr 
                    key={auc.auctionId}
                    ref={isNext ? activeRowRef : null}
                    onClick={() => setSelectedAuctionId(auc.auctionId)}
                    className={`cursor-pointer transition-colors hover:bg-[#3d2616] ${selectedAuctionId === auc.auctionId ? 'bg-[#4a2e1b] border-l-4 border-amber-500' : 'border-l-4 border-transparent'} ${isNext ? 'bg-amber-900/20' : ''}`}
                  >
                    <td className="p-2 flex items-center gap-3">
                      <div className="w-8 h-8 flex-shrink-0 bg-black/30 rounded p-1 flex items-center justify-center border border-[#4a2e1b]">
                        {(() => {
                           const imgUrl = getFullUrl(auc.itemImg, auc.itemName, assetsMap, apiUrl);
                           if (imgUrl) {
                              return <img src={imgUrl} alt={auc.itemName} className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }} />;
                           }
                           return <span className="text-[10px] text-amber-500/50 italic">?</span>;
                        })()}
                        <span className="text-[10px] text-amber-500/50 italic" style={{ display: 'none' }}>?</span>
                      </div>
                      <span className="font-semibold">{auc.itemName}</span>
                    </td>
                    <td className="p-2 text-center text-amber-200/80">{auc.type}</td>
                    <td className="p-2 text-center">
                      <div className="flex justify-center">
                        {(() => {
                           const imgUrl = getFullUrl(auc.curImg, auc.curKey, assetsMap, apiUrl);
                           if (imgUrl) {
                              return <img src={imgUrl} alt={auc.curKey} title={auc.curKey} className="w-5 h-5 object-contain" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline'; }} />;
                           }
                           return <span className="text-xs text-amber-200/50">{auc.curKey}</span>;
                        })()}
                        <span className="text-xs text-amber-200/50" style={{ display: 'none' }}>{auc.curKey}</span>
                      </div>
                    </td>
                    <td className="p-2 text-center font-mono">{auc.supply}</td>
                    <td className="p-2 font-mono text-xs">
                      <div className="flex flex-col">
                        <span className="text-amber-300 font-bold"><Countdown targetDate={auc.endAt} /></span>
                        <span className="text-amber-100/50">{new Date(auc.endAt).toLocaleDateString()}</span>
                      </div>
                    </td>
                  </tr>
                )})}
                {filteredAuctions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-amber-200/50 italic">
                      Không tìm thấy phiên đấu giá nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg">
          <i className="bi bi-exclamation-triangle-fill"></i> {error}
        </div>
      )}

      {/* AUCTION DETAILS SECTION */}
      {selectedAuctionId && (
        <div className="bg-[#1e130c] border-2 border-[#5c3a21] rounded-xl overflow-hidden shadow-2xl relative min-h-[300px]">
          {loadingDetails && (
            <div className="absolute inset-0 bg-[#1e130c]/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
               <div className="relative">
                  <span className="text-4xl animate-spin-slow inline-block drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]">🌻</span>
               </div>
               <div className="mt-4 font-bold text-amber-300">Đang tải chi tiết...</div>
            </div>
          )}

          <div className="p-5 border-b-2 border-[#5c3a21] bg-[#2a1b12]">
            <h3 className="text-xl font-bold text-white mb-4">
              Auction Details: <span className="text-amber-400">{selectedAuctionInfo?.itemName || 'Loading...'}</span>
            </h3>
            
            <div className="flex flex-col gap-1 text-amber-100/90 text-sm">
              <div>Participant count: <span className="font-bold text-white">{leaderboardData?.participantCount || 0}</span></div>
              <div>Supply: <span className="font-bold text-white">{leaderboardData?.supply || 0}</span></div>
              <div>End: <span className="font-bold text-white">{leaderboardData?.endAt ? new Date(leaderboardData.endAt).toLocaleString('en-GB') : '-'}</span></div>
            </div>
          </div>
          
          {/* SUMMARY BUTTON & TABLE */}
          <div className="px-5 py-4 border-b-2 border-[#5c3a21]">
             {!showSummary ? (
                <button 
                  onClick={fetchSummary}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded shadow-lg transition-colors flex items-center"
                >
                  <i className="bi bi-bar-chart-fill mr-2"></i>Xem tổng kết các đợt (Drops)
                </button>
             ) : (
                <div className="flex flex-col gap-4">
                  {Object.entries(
                    summaryData.reduce((acc, drop) => {
                      const key = drop.curKey || 'Khác';
                      if (!acc[key]) acc[key] = [];
                      acc[key].push(drop);
                      return acc;
                    }, {})
                  ).map(([currency, drops], groupIdx) => (
                    <div key={currency} className="bg-[#2a1b12] p-4 rounded-xl border border-[#4a2e1b]">
                      <h4 className="text-lg font-bold text-amber-400 mb-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span>Tổng kết {drops.length} đợt: </span>
                          <span className="text-white bg-[#1e130c] px-2 py-1 rounded border border-[#5c3a21] flex items-center gap-1">
                            {drops[0]?.curImg && (
                               <img src={getFullUrl(drops[0].curImg, currency, assetsMap, apiUrl)} alt={currency} className="w-5 h-5 object-contain" />
                            )}
                            {currency}
                          </span>
                        </div>
                        {isSummaryLoading && drops.some(d => d.loading) && <span className="text-sm font-normal text-amber-200/70 animate-pulse"><i className="bi bi-hourglass-split mr-1"></i>Đang tải dữ liệu...</span>}
                      </h4>
                      <div className="overflow-x-auto hide-scrollbar">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-[#4a2e1b] text-amber-200/80">
                              <th className="p-2 font-semibold">Đợt (Drop)</th>
                              <th className="p-2 font-semibold text-center">Trạng thái</th>
                              <th className="p-2 font-semibold text-right">Max Bid (Hạng 1)</th>
                              <th className="p-2 font-semibold text-right">Min Win (Cắt chóp)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#3d2616]">
                            {drops.map((drop, idx) => {
                              const now = Date.now();
                              let status = "Đã kết thúc";
                              if (drop.startAt > now) status = "Sắp tới";
                              else if (drop.endAt > now) status = "Đang diễn ra";
                              
                              let maxBid = '-';
                              let minWin = '-';
                              
                              if (drop.loading) {
                                maxBid = <span className="animate-pulse text-amber-500/50">Đang tải...</span>;
                                minWin = <span className="animate-pulse text-amber-500/50">Đang tải...</span>;
                              } else if (drop.data && drop.data.leaderboard && drop.data.leaderboard.length > 0) {
                                const ranks = drop.data.leaderboard;
                                const topUser = ranks[0];
                                const maxBidVal = extractBidValue(topUser);
                                maxBid = (
                                  <div className="flex flex-col items-end justify-center h-full">
                                    <span>{formatNumber(maxBidVal)}</span>
                                    {topUser.usdcValue !== null && topUser.usdcValue !== undefined && (
                                      <span className="text-[10px] text-emerald-400 font-sans leading-none mt-1">${formatNumber(topUser.usdcValue)}</span>
                                    )}
                                  </div>
                                );
                                
                                // Cắt chóp: rank = supply. Hoặc người cuối cùng nếu mảng trả về ít hơn
                                const cutoffRankUser = ranks.find(u => u.rank === drop.supply) || ranks[ranks.length - 1];
                                const minWinVal = extractBidValue(cutoffRankUser);
                                minWin = (
                                  <div className="flex flex-col items-end justify-center h-full">
                                    <span>{formatNumber(minWinVal)}</span>
                                    {cutoffRankUser.usdcValue !== null && cutoffRankUser.usdcValue !== undefined && (
                                      <span className="text-[10px] text-emerald-400 font-sans leading-none mt-1">${formatNumber(cutoffRankUser.usdcValue)}</span>
                                    )}
                                  </div>
                                );
                              } else if (status === "Sắp tới") {
                                maxBid = '-';
                                minWin = '-';
                              } else if (!drop.loading && !drop.data) {
                                 maxBid = <span className="text-red-400/50 italic">Lỗi</span>;
                                 minWin = <span className="text-red-400/50 italic">Lỗi</span>;
                              }
                              
                              return (
                                <tr key={drop.auctionId} className="text-amber-50 hover:bg-[#3d2616] transition-colors">
                                  <td className="p-2 font-bold text-amber-100">Drop {idx + 1}</td>
                                  <td className="p-2 text-center text-xs font-mono">
                                    {status === 'Sắp tới' ? (
                                      <div className="flex flex-col items-center">
                                        <span className="text-amber-300 font-bold"><Countdown targetDate={drop.startAt} /></span>
                                        <span className="text-amber-100/50 text-[10px]">{new Date(drop.startAt).toLocaleDateString('en-GB')}</span>
                                      </div>
                                    ) : (
                                      <span className={`px-2 py-0.5 rounded-full font-sans ${status === 'Đang diễn ra' ? 'bg-green-900 text-green-300' : 'bg-[#4a2e1b] text-amber-200/50'}`}>
                                        {status}
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right font-mono font-bold text-white">{maxBid}</td>
                                  <td className="p-2 text-right font-mono text-amber-300">{minWin}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
             )}
          </div>
          
          <div className="p-5">
            <h4 className="text-lg font-bold text-white mb-3">Leaderboard</h4>
            
            {leaderboardData && leaderboardData.leaderboard && (
              <div className="overflow-x-auto hide-scrollbar bg-black/20 rounded-lg border border-[#4a2e1b]">
                <table className="w-full text-left border-collapse whitespace-nowrap text-sm">
                  <thead>
                      <tr className="bg-[#2a1b12] text-white font-bold border-b-2 border-[#4a2e1b]">
                        <th className="p-3 text-center w-16">Rank</th>
                        <th className="p-3">Username</th>
                        <th className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {leaderboardData.curImg ? (
                               <img src={getFullUrl(leaderboardData.curImg, leaderboardData.curKey, assetsMap, apiUrl)} alt="Currency" className="w-5 h-5 object-contain" />
                            ) : (
                               "Bid"
                            )}
                          </div>
                        </th>
                        {leaderboardData.curKey === 'Flower' && (
                          <th className="p-3 text-right">
                            <img src="https://assets.coingecko.com/coins/images/6319/standard/usdc.png" alt="USDC" className="w-5 h-5 ml-auto" />
                          </th>
                        )}
                        <th className="p-3 text-right">XP</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3d2616]">
                    {leaderboardData.leaderboard.map((user, idx) => {
                      const isWinning = user.rank <= leaderboardData.supply;
                      const isMe = user.farmId.toString() === currentId.toString();
                      
                      return (
                        <tr 
                          key={user.farmId || idx} 
                          className={`transition-colors ${isMe ? 'bg-amber-500/20' : 'hover:bg-[#3d2616]'} ${isWinning ? 'text-amber-100' : 'text-amber-100/50'}`}
                        >
                          <td className="p-3 text-center font-mono">
                             {user.rank}
                          </td>
                          <td className="p-3 font-semibold flex items-center gap-2">
                            {user.username}
                            {isMe && <span className="text-[10px] bg-amber-500 text-slate-900 px-1.5 py-0.5 rounded font-bold">YOU</span>}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-white">
                            {formatNumber(extractBidValue(user))}
                          </td>
                          {leaderboardData.curKey === 'Flower' && (
                            <td className="p-3 text-right font-mono text-emerald-400">
                              {user.usdcValue !== null ? '$' + formatNumber(user.usdcValue) : '-'}
                            </td>
                          )}
                          <td className="p-3 text-right font-mono text-amber-200/80">
                            {formatXP(user.experience)}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {leaderboardData.leaderboard.length === 0 && (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-amber-200/50 italic">
                          Chưa có dữ liệu cho phiên đấu giá này.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global styles for scrollbar in this component */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e130c;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #4a2e1b;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #5c3a21;
        }
      `}</style>
    </div>
  );
};

export default AuctionsPanel;
