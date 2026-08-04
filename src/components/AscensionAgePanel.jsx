import React from 'react';

const AscensionAgePanel = () => {
  const featherIcon = <img src="/shiny_feather.webp" alt="Shiny Feather" className="w-4 h-4 object-contain inline-block drop-shadow-sm" />;
  const gemIcon = <span className="text-sm shadow-purple-500/50 drop-shadow-md">💎</span>;
  const flowerIcon = <span className="text-sm shadow-pink-500/50 drop-shadow-md">🌸</span>;

  const megastoreItems = [
    { name: 'Moon Hair', cost: '9000', type: 'Shiny Feather', icon: featherIcon },
    { name: 'Astrolabe', cost: '9000', type: 'Shiny Feather', icon: featherIcon },
    { name: 'Ascension Monument', cost: '4000', type: 'Shiny Feather', icon: featherIcon }
  ];

  const auctionItems = [
    // --- Giai đoạn 1: Flowers ---
    { name: 'Rice Shirt', buff: '+1 Lúa gạo (Rice)', type: 'Flowers', phase: <span className="flex items-center gap-1.5">Đợt 1 (Flowers {flowerIcon})</span>, time: '22/08 - 23/08', supply: 8 },
    { name: 'Vibraphone', buff: 'x2 thời gian buff của thức ăn', type: 'Flowers', phase: <span className="flex items-center gap-1.5">Đợt 1 (Flowers {flowerIcon})</span>, time: '25/08 - 26/08', supply: 20 },
    { name: 'Surfer Hair', buff: 'Giảm 50% muối khi ủ đồ', type: 'Flowers', phase: <span className="flex items-center gap-1.5">Đợt 1 (Flowers {flowerIcon})</span>, time: '27/08 - 28/08', supply: 8 },
    { name: 'Alchemist Apron', buff: 'Giảm 50% phí/thời gian chế Thuốc', type: 'Flowers', phase: <span className="flex items-center gap-1.5">Đợt 1 (Flowers {flowerIcon})</span>, time: '29/08 - 30/08', supply: 8 },
    { name: 'Winged Vase', buff: '+14% tỉ lệ Prime Aged', type: 'Flowers', phase: <span className="flex items-center gap-1.5">Đợt 1 (Flowers {flowerIcon})</span>, time: '01/09 - 02/09', supply: 8 },
    { name: 'Ascended Idol', buff: 'Thu hoạch Muối MIỄN PHÍ', type: 'Flowers', phase: <span className="flex items-center gap-1.5">Đợt 1 (Flowers {flowerIcon})</span>, time: '03/09 - 04/09', supply: 6 },
    { name: 'Salt Worker Gnome', buff: '+2 Muối & -30% thời gian', type: 'Flowers', phase: <span className="flex items-center gap-1.5">Đợt 1 (Flowers {flowerIcon})</span>, time: '08/09 - 09/09', supply: 5 },

    // --- Giai đoạn 2: Gems ---
    { name: 'Vibraphone', buff: 'x2 thời gian buff của thức ăn', type: 'Gems', phase: <span className="flex items-center gap-1.5">Đợt 2 (Gems {gemIcon})</span>, time: '10/09 - 11/09', supply: 20 },
    { name: 'Surfer Hair', buff: 'Giảm 50% muối khi ủ đồ', type: 'Gems', phase: <span className="flex items-center gap-1.5">Đợt 2 (Gems {gemIcon})</span>, time: '15/09 - 16/09', supply: 8 },
    { name: 'Winged Vase', buff: '+14% tỉ lệ Prime Aged', type: 'Gems', phase: <span className="flex items-center gap-1.5">Đợt 2 (Gems {gemIcon})</span>, time: '17/09 - 18/09', supply: 8 },
    { name: 'Rice Shirt', buff: '+1 Lúa gạo (Rice)', type: 'Gems', phase: <span className="flex items-center gap-1.5">Đợt 2 (Gems {gemIcon})</span>, time: '19/09 - 20/09', supply: 8 },
    { name: 'Ascended Idol', buff: 'Thu hoạch Muối MIỄN PHÍ', type: 'Gems', phase: <span className="flex items-center gap-1.5">Đợt 2 (Gems {gemIcon})</span>, time: '22/09 - 23/09', supply: 6 },
    { name: 'Salt Worker Gnome', buff: '+2 Muối & -30% thời gian', type: 'Gems', phase: <span className="flex items-center gap-1.5">Đợt 2 (Gems {gemIcon})</span>, time: '24/09 - 25/09', supply: 5 },
    { name: 'Alchemist Apron', buff: 'Giảm 50% phí/thời gian chế Thuốc', type: 'Gems', phase: <span className="flex items-center gap-1.5">Đợt 2 (Gems {gemIcon})</span>, time: '26/09 - 27/09', supply: 8 },

    // --- Giai đoạn 3: Shiny Feathers ---
    { name: 'Vibraphone', buff: 'x2 thời gian buff của thức ăn', type: 'Feathers', phase: <span className="flex items-center gap-1.5">Đợt 3 (Feathers {featherIcon})</span>, time: '06/10 - 07/10', supply: 20 },
    { name: 'Rice Shirt', buff: '+1 Lúa gạo (Rice)', type: 'Feathers', phase: <span className="flex items-center gap-1.5">Đợt 3 (Feathers {featherIcon})</span>, time: '08/10 - 09/10', supply: 8 },
    { name: 'Ascended Idol', buff: 'Thu hoạch Muối MIỄN PHÍ', type: 'Feathers', phase: <span className="flex items-center gap-1.5">Đợt 3 (Feathers {featherIcon})</span>, time: '08/10 - 09/10', supply: 6 },
    { name: 'Salt Worker Gnome', buff: '+2 Muối & -30% thời gian', type: 'Feathers', phase: <span className="flex items-center gap-1.5">Đợt 3 (Feathers {featherIcon})</span>, time: '09/10 - 10/10', supply: 5 },
    { name: 'Alchemist Apron', buff: 'Giảm 50% phí/thời gian chế Thuốc', type: 'Feathers', phase: <span className="flex items-center gap-1.5">Đợt 3 (Feathers {featherIcon})</span>, time: '10/10 - 11/10', supply: 8 },
    { name: 'Surfer Hair', buff: 'Giảm 50% muối khi ủ đồ', type: 'Feathers', phase: <span className="flex items-center gap-1.5">Đợt 3 (Feathers {featherIcon})</span>, time: '10/10 - 11/10', supply: 8 },
    { name: 'Winged Vase', buff: '+14% tỉ lệ Prime Aged', type: 'Feathers', phase: <span className="flex items-center gap-1.5">Đợt 3 (Feathers {featherIcon})</span>, time: '10/10 - 11/10', supply: 8 },
  ];

  const mutants = [
    { name: 'Dumbo Octopus', buff: '20% cơ hội +1 cá khi câu (Tỉ lệ rớt 0.5% từ Flounder/Napoleonfish)', type: 'Câu cá' },
    { name: 'Ascended Chicken', buff: '+0.1 Trứng khi thu hoạch gà', type: 'Động vật' },
    { name: 'Ascended Sheep', buff: '+0.1 Lông cừu khi thu hoạch cừu', type: 'Động vật' },
    { name: 'Ascended Cow', buff: '+0.1 Sữa khi thu hoạch bò', type: 'Động vật' },
    { name: 'Ruins Flower', buff: '+0.05 Mật ong khi thu hoạch tổ ong', type: 'Hoa' }
  ];

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Banner */}
      <div className="w-full rounded-2xl overflow-hidden shadow-2xl border border-indigo-500/30 relative group">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80 z-10"></div>
        <img 
          src="/img/ascension_age.png" 
          alt="Ascension Age Banner" 
          className="w-full h-48 md:h-64 object-cover group-hover:scale-105 transition-transform duration-700" 
        />
        <div className="absolute bottom-4 left-6 z-20">
          <h2 className="text-3xl font-black text-white drop-shadow-md">Ascension Age NFTs</h2>
          <p className="text-indigo-200 text-sm font-medium">Theo dõi lịch đấu giá và hàng bán tại Megastore</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Stella's Megastore */}
        <div className="glass-panel h-fit">
          <div className="glass-header bg-gradient-to-r from-pink-900/40 to-purple-900/40 border-b border-pink-500/30">
            <span className="flex items-center text-pink-300">
              <i className="bi bi-shop mr-2 text-xl"></i> Stella's Megastore
            </span>
          </div>
          <div className="glass-body p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {megastoreItems.map((item, idx) => (
              <div key={idx} className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 flex flex-col justify-center items-center text-center shadow-sm hover:border-pink-500/30 transition-colors">
                <div className="font-bold text-slate-200 text-sm mb-2">{item.name}</div>
                <div className="bg-slate-900/60 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border border-slate-800">
                  {item.icon} {item.cost} {item.type}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cày cuốc / Đột biến */}
        <div className="glass-panel h-fit">
          <div className="glass-header bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-b border-emerald-500/30">
            <span className="flex items-center text-emerald-300">
              <i className="bi bi-stars mr-2 text-xl"></i> Mutants & Gameplay Drops
            </span>
          </div>
          <div className="glass-body p-4 space-y-3">
            {mutants.map((item, idx) => (
              <div key={idx} className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-emerald-500/30 transition-colors">
                <div>
                  <div className="font-bold text-slate-200 text-sm">{item.name}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.buff}</div>
                </div>
                <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider whitespace-nowrap w-fit">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Lịch Đấu Giá */}
      <div className="glass-panel">
        <div className="glass-header bg-gradient-to-r from-amber-900/40 to-orange-900/40 border-b border-amber-500/30">
          <span className="flex items-center text-amber-400">
            <i className="bi bi-hammer mr-2 text-xl"></i> Lịch Đấu Giá (Auction House)
          </span>
        </div>
        <div className="glass-body p-0 overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Tên Vật Phẩm</th>
                <th className="px-6 py-4 font-semibold">Tác dụng (Buff)</th>
                <th className="px-6 py-4 font-semibold">Giai đoạn (Nguyên liệu Bid)</th>
                <th className="px-6 py-4 font-semibold text-right">Thời gian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {auctionItems.map((item, idx) => {
                let badgeClass = "bg-slate-800 text-slate-300 border-slate-600";
                if (item.type === 'Flowers') badgeClass = "bg-pink-900/30 text-pink-300 border-pink-500/30";
                if (item.type === 'Gems') badgeClass = "bg-purple-900/30 text-purple-300 border-purple-500/30";
                if (item.type === 'Feathers') badgeClass = "bg-blue-900/30 text-blue-300 border-blue-500/30";

                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-200">{item.name}</td>
                    <td className="px-6 py-4 text-slate-400 text-xs whitespace-normal min-w-[200px]">{item.buff}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${badgeClass}`}>
                        {item.phase}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono inline-flex items-center gap-2">
                          <i className="bi bi-calendar-event text-slate-400"></i> {item.time}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 bg-slate-900/40 px-2 py-0.5 rounded border border-slate-800">
                          <span className="font-mono tracking-tighter">06:00, 11:00, 16:00, 21:00, 02:00</span>
                          <span className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-900/50">SL: {item.supply}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-900/30 text-xs text-slate-400 border-t border-slate-700/50 flex items-start gap-2">
          <i className="bi bi-info-circle text-amber-500"></i>
          <p>Dữ liệu đấu giá chính thức mùa Ascension Age. Mỗi đợt (drop) diễn ra vào 5 khung giờ liên tiếp trong vòng 2 ngày (VD: 06:00, 11:00, 16:00, 21:00 và 02:00 sáng hôm sau - theo giờ VN GMT+7).</p>
        </div>
      </div>

    </div>
  );
};

export default AscensionAgePanel;
