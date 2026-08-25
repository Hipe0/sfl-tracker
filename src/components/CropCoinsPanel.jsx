import React, { useState, useEffect, useCallback } from 'react';
import { useFarm } from '../context/FarmContext';

const COIN_IMG = 'https://sfl.world/img/items/Coin.png';
const FLOWER_IMG = 'https://sfl.world/img/items/Flower.png';

const SKILL_ICONS = {
  'Green Thumb': 'https://sfl.world/img/skills/Green_Thumb.png',
  'Coin Swindler': 'https://sfl.world/img/skills/Coin_Swindler.png',
  'Cultivator': 'https://sfl.world/img/skills/Cultivator.png',
  'Fruit Picker Profit': 'https://sfl.world/img/skills/Fruit_Picker_Profit.png',
};

const CropCoinsPanel = () => {
  const { currentId, farmData } = useFarm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('coinsPerFlower');
  const [sortDir, setSortDir] = useState('desc');
  const [filterCategory, setFilterCategory] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const params = currentId ? `?farmId=${currentId}` : '';
      const res = await fetch(`${apiUrl}/api/crop-coins${params}`);
      if (!res.ok) throw new Error('Không thể tải dữ liệu Crop to Coin');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Lỗi không xác định');
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const coinRate = data?.coinRate || 320;
  
  const CROP_SKILL_BUFFS = {
    'Green Thumb': { ranks: { 1: 0.05, 2: 0.10, 3: 0.15 }, applies_to: 'crops' },
    'Coin Swindler': { ranks: { 1: 0.10, 2: 0.20, 3: 0.30 }, applies_to: 'crops' },
    'Cultivator': { ranks: { 1: 0.05, 2: 0.10, 3: 0.15 }, applies_to: 'fruits' },
    'Fruit Picker Profit': { ranks: { 1: 0.10, 2: 0.15, 3: 0.20 }, applies_to: 'fruits' },
  };

  // Determine ranks from farmData (checks only inventory for Green Thumb as per SFL codebase)
  const checkRank = (obj, key) => Number(obj?.[key]) > 0;
  
  let greenThumbRank = Number(farmData?.gameData?.bumpkin?.skills?.['Green Thumb']) || 0;
  if (greenThumbRank === 0 && (checkRank(farmData?.gameData?.inventory, 'Green Thumb') || 
      checkRank(farmData?.inventory, 'Green Thumb'))) {
    greenThumbRank = 1;
  }

  const coinSwindlerRank = Number(farmData?.gameData?.bumpkin?.skills?.['Coin Swindler']) || 0;
  const cultivatorRank = Number(farmData?.gameData?.bumpkin?.skills?.['Cultivator']) || 0;
  const fruitPickerProfitRank = Number(farmData?.gameData?.bumpkin?.skills?.['Fruit Picker Profit']) || 0;

  // Calculate total crop buff based on frontend data
  let cropBuff = 0;
  let fruitBuff = 0;
  
  if (greenThumbRank > 0) cropBuff += CROP_SKILL_BUFFS['Green Thumb'].ranks[greenThumbRank] || CROP_SKILL_BUFFS['Green Thumb'].ranks[1];
  if (coinSwindlerRank > 0) {
    const swindlerRanks = CROP_SKILL_BUFFS['Coin Swindler'].ranks;
    cropBuff += swindlerRanks[coinSwindlerRank] || swindlerRanks[Math.max(...Object.keys(swindlerRanks).map(Number))];
  }

  if (cultivatorRank > 0) {
    const cultivatorRanks = CROP_SKILL_BUFFS['Cultivator'].ranks;
    fruitBuff += cultivatorRanks[cultivatorRank] || cultivatorRanks[Math.max(...Object.keys(cultivatorRanks).map(Number))];
  }
  if (fruitPickerProfitRank > 0) {
    const pickerRanks = CROP_SKILL_BUFFS['Fruit Picker Profit'].ranks;
    fruitBuff += pickerRanks[fruitPickerProfitRank] || pickerRanks[Math.max(...Object.keys(pickerRanks).map(Number))];
  }

  const sortedCrops = data?.crops
    ?.filter(c => filterCategory === 'all' || c.category === filterCategory)
    ?.map(c => {
      // Recalculate based on frontend detected buff!
      if (c.category === 'crop' || c.category === 'greenhouse' || c.category === 'fruit') {
        const buff = c.category === 'fruit' ? fruitBuff : cropBuff;
        const buffedSellCoins = c.baseSellCoins * (1 + buff);
        const coinsPerFlower = buffedSellCoins / c.marketP2P;
        const percentage = (coinsPerFlower - coinRate) / coinRate * 100;
        return {
          ...c,
          buffedSellCoins: Number(buffedSellCoins.toFixed(3)),
          coinsPerFlower: Number(coinsPerFlower.toFixed(2)),
          percentage: Number(percentage.toFixed(2)),
          isProfitable: percentage > 0
        };
      }
      return c;
    })
    ?.slice()
    ?.sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortDir === 'asc' ? va - vb : vb - va;
    }) || [];

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <i className="bi bi-arrow-down-up opacity-30 ml-1 text-[10px]" />;
    return sortDir === 'desc'
      ? <i className="bi bi-arrow-down ml-1 text-amber-400 text-[10px]" />
      : <i className="bi bi-arrow-up ml-1 text-amber-400 text-[10px]" />;
  };

  const ColHeader = ({ col, label, className = '' }) => (
    <th
      className={`px-4 py-3 text-left font-bold text-amber-400 uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-amber-300 transition-colors whitespace-nowrap ${className}`}
      onClick={() => handleSort(col)}
    >
      <span className="flex items-center gap-1">{label}<SortIcon col={col} /></span>
    </th>
  );



  const username = farmData?.username || '';
  const farmIdToDisplay = currentId || data?.farmId || '';

  const SkillCard = ({ name, ranks, userRank, appliesTo }) => {
    const isActive = userRank > 0;
    const rankKeys = Object.keys(ranks).map(Number);
    const maxRank = Math.max(...rankKeys);
    const appliedRank = userRank > maxRank ? maxRank : userRank;
    const currentBuff = isActive ? ranks[appliedRank] : ranks[1];
    
    return (
      <div className={`relative flex items-center gap-3 bg-slate-800/80 border ${isActive ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]' : 'border-slate-600/50 opacity-60 grayscale'} rounded-xl px-4 py-3 transition-all cursor-help group`}>
        <div className="relative">
          <img src={SKILL_ICONS[name] || `https://sfl.world/img/skills/${encodeURIComponent(name.replace(/ /g, '_'))}.png`} alt={name} className="w-10 h-10 object-contain drop-shadow-md" onError={(e) => { e.target.style.display = 'none'; }} />
          {isActive && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-800 animate-pulse"></div>}
        </div>
        <div className="flex-1">
          <div className={`font-bold text-sm ${isActive ? 'text-amber-400' : 'text-slate-300'}`}>{name}</div>
          <div className="text-slate-400 text-[11px] leading-tight">
            +{Math.round(currentBuff * 100)}% coins when selling {appliesTo} (Seed Shop)
          </div>
          {rankKeys.length > 1 && (
            <div className="flex items-center gap-1 mt-1.5">
              {rankKeys.map(r => (
                 <span key={r} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${userRank >= r ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_5px_rgba(245,158,11,0.2)]' : 'bg-slate-700/50 text-slate-500 border border-slate-700'}`}>
                   r{r}
                 </span>
              ))}
            </div>
          )}
        </div>
        {/* Tooltip */}
        {rankKeys.length > 1 && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded shadow-xl p-2 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10">
            <div className="font-bold text-amber-400 mb-1">{name} Buffs:</div>
            {rankKeys.map(r => (
              <div key={r} className={`flex items-center justify-between gap-6 ${userRank === r ? 'text-emerald-400 font-bold' : ''}`}>
                 <span>Rank {r}</span>
                 <span>+{Math.round(ranks[r]*100)}%</span>
              </div>
            ))}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 border-b border-r border-slate-700 rotate-45"></div>
          </div>
        )}
      </div>
    );
  };

  const bumpkinAvatar = farmData?.globalConfig?.bumpkin?.avatar || "https://animations.sunflower-land.com/bumpkin_image/0_v1_32_90_52_282_234_89_240_424_0_228_0_562_0_374_0_0_559/100";

  return (
    <div className="glass-panel">
      <div className="glass-header flex items-center gap-2">
        <span className="text-xl">🌾</span>
        <span>Crop to Coin</span>
        <span className="text-sm text-slate-400 font-normal ml-2">— Mua P2P → Bán Seed Shop</span>
      </div>

      <div className="glass-body">
        {/* Farm Info Header */}
        {farmIdToDisplay && (
          <div className="flex flex-wrap items-center gap-4 mb-5 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center border border-slate-700 overflow-hidden">
                <img src={bumpkinAvatar} alt="Farm Avatar" className="w-full h-full object-contain p-0.5" />
              </div>
              <div>
                <div className="text-xs text-slate-400">Farm ID</div>
                <div className="font-mono font-bold text-amber-300">#{farmIdToDisplay}</div>
              </div>
            </div>
            {username && (
              <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                <div>
                  <div className="text-xs text-slate-400">Tên Farm</div>
                  <div className="font-bold text-emerald-300">{username}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Skill Buff Banner */}
        <div className="flex flex-col gap-2 mb-5">
          <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <i className="bi bi-stars text-amber-400"></i> Skill Buff (Crops):
          </div>
          <div className="flex flex-wrap gap-4">
            <SkillCard name="Green Thumb" ranks={CROP_SKILL_BUFFS['Green Thumb'].ranks} userRank={greenThumbRank} appliesTo="crops" />
            <SkillCard name="Coin Swindler" ranks={CROP_SKILL_BUFFS['Coin Swindler'].ranks} userRank={coinSwindlerRank} appliesTo="crops" />
          </div>
        </div>

        {(!data?.hasFarmId && !currentId) && (
          <div className="mb-4 bg-amber-900/20 border border-amber-500/30 rounded-lg px-4 py-2.5 text-amber-300 text-sm flex items-center gap-2">
            <i className="bi bi-info-circle" />
            Nhập Farm ID để xem thông tin và Skill Buff áp dụng cho tài khoản của bạn
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-1 border border-slate-700/50">
            {[
              { key: 'all', label: '🌾 Tất cả' },
              { key: 'crop', label: '🌱 Crops' },
              { key: 'fruit', label: '🍎 Fruits' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterCategory(key)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  filterCategory === key
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 flex items-center gap-1">
              Baseline: 1
              <img src={FLOWER_IMG} className="w-3.5 h-3.5 object-contain inline" alt="FLW"
                onError={(e) => { e.target.outerHTML = '<span class="text-emerald-400 font-mono text-xs">FLW</span>'; }} />
              = {coinRate}
              <img src={COIN_IMG} className="w-3.5 h-3.5 object-contain inline" alt="Coin"
                onError={(e) => { e.target.style.display = 'none'; }} />
            </span>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 bg-slate-700/80 hover:bg-slate-600/80 border border-slate-600/50 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm mb-4">
            <i className="bi bi-exclamation-triangle mr-2" />{error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <i className="bi bi-arrow-clockwise animate-spin text-2xl mr-3" />
            Đang tải giá thị trường P2P...
          </div>
        )}

        {/* Table */}
        {sortedCrops.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-700/50">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 border-b border-slate-700/50">
                <tr>
                  <ColHeader col="name" label="Resource" className="min-w-[150px]" />
                  <ColHeader col="buffedSellCoins" label={
                    <span className="flex items-center gap-1">
                      Sell Value Per
                      <img src={COIN_IMG} className="w-3.5 h-3.5 object-contain" alt="Coin"
                        onError={(e) => { e.target.style.display = 'none'; }} />
                      Coins
                    </span>
                  } />
                  <ColHeader col="marketP2P" label="Market Value P2P" />
                  <ColHeader col="coinsPerFlower" label={
                    <span className="flex items-center gap-1">
                      Coins Earned Per 1
                      <img src={FLOWER_IMG} className="w-3.5 h-3.5 object-contain" alt="FLW"
                        onError={(e) => { e.target.outerHTML = '<span class="text-emerald-400 font-mono text-xs">FLW</span>'; }} />
                      <span className="text-slate-500 font-normal ml-1">1 →</span>
                      <img src={COIN_IMG} className="w-3.5 h-3.5 object-contain ml-0.5" alt="Coin"
                        onError={(e) => { e.target.style.display = 'none'; }} />
                      <span className="text-yellow-400 font-mono">{coinRate}</span>
                    </span>
                  } />
                  <th
                    className="px-4 py-3 text-right font-bold text-amber-400 uppercase tracking-wider text-[11px] cursor-pointer select-none hover:text-amber-300 transition-colors whitespace-nowrap"
                    onClick={() => handleSort('percentage')}
                  >
                    <span className="flex items-center justify-end gap-1">
                      Percentage
                      <SortIcon col="percentage" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {sortedCrops.map((crop, idx) => {
                  const isProfitable = crop.percentage > 0;
                  const isHighProfit = crop.percentage > 300;
                  return (
                    <tr
                      key={crop.name}
                      className={`transition-colors ${
                        idx % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-800/20'
                      } hover:bg-slate-700/30`}
                    >
                      {/* Resource */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://sfl.world/img/delivery/${encodeURIComponent(crop.name)}.png`}
                            alt={crop.name}
                            className="w-6 h-6 object-contain drop-shadow-md"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://sfl.world/img/items/${encodeURIComponent(crop.name)}.png`;
                            }}
                          />
                          <span className="font-medium text-slate-200">{crop.name}</span>
                          {crop.category === 'fruit' && (
                            <span className="text-[9px] bg-orange-900/40 text-orange-400 border border-orange-500/30 px-1 py-0.5 rounded font-bold">Fruit</span>
                          )}
                        </div>
                      </td>

                      {/* Sell Value Per Coins */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono font-semibold text-yellow-300">
                          <img src={COIN_IMG} className="w-4 h-4 object-contain" alt="Coin"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                          {crop.buffedSellCoins.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                        </span>
                      </td>

                      {/* Market Value P2P */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono text-slate-300">
                          <img src={FLOWER_IMG} className="w-4 h-4 object-contain" alt="FLW"
                            onError={(e) => { e.target.outerHTML = '<span class="text-emerald-400 font-mono text-xs">FLW</span>'; }} />
                          {crop.marketP2P.toFixed(6)}
                        </span>
                      </td>

                      {/* Coins Earned Per 1 FLW */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 font-mono font-semibold text-yellow-300">
                          <img src={COIN_IMG} className="w-4 h-4 object-contain" alt="Coin"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                          {crop.coinsPerFlower.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Percentage */}
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold font-mono text-sm ${
                          isHighProfit ? 'text-emerald-300' :
                          isProfitable ? 'text-emerald-500' :
                          'text-rose-400'
                        }`}>
                          {isProfitable ? '+' : ''}{crop.percentage.toFixed(2)} %
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {sortedCrops.length === 0 && !loading && data && (
          <div className="text-center py-12 text-slate-400">
            <i className="bi bi-inbox text-4xl block mb-3" />
            Không có dữ liệu — chưa có giá P2P cho mặt hàng này
          </div>
        )}

        {data && (
          <div className="mt-3 text-[11px] text-slate-500 text-right">
            Cập nhật: {new Date(data.timestamp).toLocaleString('vi-VN')}
          </div>
        )}
      </div>
    </div>
  );
};

export default CropCoinsPanel;
