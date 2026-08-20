import React, { useState, useEffect, useCallback } from 'react';
import { useFarm } from '../context/FarmContext';

const COIN_IMG = "data:image/webp;base64,UklGRuoAAABXRUJQVlA4WAoAAAAQAAAADQAADgAAVlA4THUAAAAvDYADECdAmG00f7HtfRKnpCBtA2b+Fc3ahyDbZgZjHPM9zjD/AfBXTLpRcNBGkiPVBwIbCEzfIFgtgNT8Wf1jiOg/wSRNtR0DLBsgS3xhVdUDK6T9e3aWuKuWo+EMhX27VPPPzVpGjq8fXZtpzy+sRxfA/gIAUFNBSU4AAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQoAAAAAAAMAAAAAj/wAAAAAAAAOEJJTQRDAAAAAAANUGJlVwEQAAUBAAAAAAA=";

const CraftingCostsPanel = () => {
  const { currentId } = useFarm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    if (!currentId) return;
    setLoading(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/crafting-costs?farmId=${currentId}`);
      if (!res.ok) throw new Error('Không thể tải dữ liệu chi phí');
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 glass-panel animate-pulse-soft">
        <div className="text-4xl animate-spin-slow mb-4">⚒️</div>
        <div className="text-amber-300 font-bold">Đang tính toán chi phí...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500 text-red-100 p-4 rounded-xl text-center">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const categoriesMap = {
    tools: { icon: '🪓', label: 'Công Cụ (Tools)' },
    food: { icon: '🍳', label: 'Thức Ăn (Food)' },
    seeds: { icon: '🌾', label: 'Hạt Giống (Seeds & Crops)' },
    flowers: { icon: '🌸', label: 'Hoa (Flowers)' },
    crafts: { icon: '🛠️', label: 'Chế Tạo (Crafts)' },
    fishing: { icon: '🐟', label: 'Câu Cá / Bẫy (Fishing)' },
    sellables: { icon: '💰', label: 'Vật Phẩm Bán (Sellables)' }
  };

  const filterItems = (items) => {
    if (!searchTerm) return items;
    return items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const formatSfl = (val) => Number(val).toFixed(3);

  const renderTable = (categoryId, items) => {
    const filtered = filterItems(items);
    if (filtered.length === 0) return null;

    const { icon, label } = categoriesMap[categoryId] || { icon: '📦', label: categoryId };

    return (
      <div key={categoryId} className="mb-8">
        <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
          <span>{icon}</span> {label}
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-700/50 shadow-lg">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-800/80 border-b border-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Tên Món</th>
                <th className="px-4 py-3 font-semibold">Nguyên Liệu (P2P / Coins)</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap text-right text-amber-300">Tổng Chi Phí (~SFL)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-slate-900/40">
              {filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200">
                    <div className="flex items-center gap-2">
                      <img 
                        src={`https://sfl.world/img/items/${encodeURIComponent(item.name.split(' (')[0].toLowerCase().replace(/ /g, '_'))}.png`} 
                        alt={item.name}
                        className="w-5 h-5 object-contain drop-shadow-sm"
                        onError={(e) => { 
                          e.target.onerror = null; 
                          e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(item.name.split(' (')[0])}.png`; 
                        }}
                      />
                      <div>
                        {item.name}
                        {item.yield && <span className="block text-[10px] text-slate-500 mt-0.5">Thu hoạch: {item.yield}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                      {item.ingredients && item.ingredients.length > 0 ? item.ingredients.map((ing, i) => {
                        const ingCleanName = ing.name.split(' (')[0];
                        const ingImgUrl = ing.name === 'Coins' 
                           ? COIN_IMG 
                           : `https://sfl.world/img/items/${encodeURIComponent(ingCleanName.toLowerCase().replace(/ /g, '_'))}.png`;
                           
                        return (
                          <div key={i} className="flex items-center justify-between bg-slate-800/50 px-2 py-1.5 rounded border border-slate-700/50 text-[11.5px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-amber-200 min-w-[20px] text-right">{ing.amount}</span>
                              <img 
                                src={ingImgUrl} 
                                className="w-4 h-4 object-contain" 
                                alt={ing.name}
                                onError={(e) => { 
                                  e.target.onerror = null; 
                                  e.target.src=`https://sfl.world/img/delivery/${encodeURIComponent(ingCleanName)}.png`; 
                                }}
                              />
                              <span className="text-slate-300 font-medium truncate max-w-[100px]">{ing.name}</span>
                            </div>
                            <span className="text-emerald-400/90 font-medium ml-4">
                              ~{formatSfl(ing.sflCost)} SFL
                            </span>
                          </div>
                        );
                      }) : (
                        <span className="text-slate-500 italic text-xs">Không tốn</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-300 whitespace-nowrap">
                    {formatSfl(item.totalSfl)} SFL
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="glass-panel p-4 md:p-6 rounded-2xl border border-slate-700/50 animate-fade-in-up">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <i className="bi bi-hammer"></i> Bảng Giá Chế Tạo
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Tra cứu chi phí của tất cả vật phẩm. Tỷ giá P2P realtime. Giá Coin: <strong className="text-amber-300">{Number(data.coinRate).toLocaleString()} Coins = 1 SFL</strong>.
          </p>
        </div>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Tìm kiếm vật phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-2.5 transition-all"
          />
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <i className="bi bi-search text-slate-400"></i>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {data.categories && Object.entries(data.categories).map(([catId, items]) => renderTable(catId, items))}
      </div>
    </div>
  );
};

export default CraftingCostsPanel;
