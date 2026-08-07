import React, { useMemo, useEffect, useRef } from 'react';
import { detailedAuctions } from '../data/auctions.js';

const featherIcon = <img src="/shiny_feather.webp" alt="Shiny Feather" className="w-4 h-4 object-contain inline-block drop-shadow-sm" />;
const gemIcon = <span className="text-sm shadow-purple-500/50 drop-shadow-md">💎</span>;
const flowerIcon = <img src="/img/flower.webp" alt="Flowers" className="w-4 h-4 object-contain inline-block drop-shadow-sm" />;
const sflIcon = <img src="/img/sfl.webp" alt="SFL" className="w-4 h-4 object-contain inline-block drop-shadow-sm" />;
const coinIcon = <i className="bi bi-coin text-yellow-400"></i>;
const pebbleIcon = <img src="/img/otter_pebble.webp" alt="Otter Pebble" className="w-4 h-4 object-contain inline-block drop-shadow-sm" />;

const megastoreItems = [
  { name: 'Moon Hair', cost: '9000', type: 'Shiny Feather', icon: featherIcon, image: '/img/moon_hair.png', buff: '+2 Giới hạn hạt Trăng Rằm, +0.5 Trái cây Trăng Rằm' },
  { name: 'Astrolabe', cost: '9000', type: 'Shiny Feather', icon: featherIcon, image: '/img/sfts/astrolabe.webp', buff: '15% cơ hội x2 Máy lên men & Gia vị, +5% EXP Cá lâu năm' },
  { name: 'Cornucopia', cost: '9000', type: 'Shiny Feather', icon: featherIcon, image: '/img/sfts/cornucopia.webp', buff: '+1 Trái cây Khổng Lồ (từ Dự án Làng)' },
  { name: 'Teamwork Monument', cost: '6000', type: 'Shiny Feather', icon: featherIcon, image: '/img/sfts/teamwork_monument.webp', buff: '+1 Giới hạn trợ giúp (Help Limit)' },
  { name: 'Ascension Monument', cost: '4000', type: 'Shiny Feather', icon: featherIcon, image: '/img/sfts/ascension_monument.webp', buff: '-20% thời gian mở rộng đảo' },
  { name: 'Otty the Otter', cost: '250', type: 'Otter Pebble', icon: pebbleIcon, image: '/img/sfts/otty_the_otter.webp', buff: '+5 Mồi câu/ngày, +1 Cá ngẫu nhiên mỗi 15 lần câu' },
  { name: 'Swamp Pants', cost: '50', type: 'FLW', icon: flowerIcon, hasVipDiscount: true, image: '/img/swamp_pants.png', buff: <span className="flex items-center justify-center gap-1 text-[#10b981] font-bold">+1 Shiny Feather <img src="/shiny_feather.webp" alt="Shiny Feather" className="w-3.5 h-3.5 drop-shadow-sm" /></span> },
  { name: 'Swamp Armor', cost: '10', type: 'FLW', icon: flowerIcon, hasVipDiscount: true, image: '/img/swamp_armor.png', buff: <span className="flex items-center justify-center gap-1 text-[#10b981] font-bold">+1 Shiny Feather <img src="/shiny_feather.webp" alt="Shiny Feather" className="w-3.5 h-3.5 drop-shadow-sm" /></span> },
  { name: 'Swamp Lily Hat', cost: '5000', type: 'Coins', icon: coinIcon, image: '/img/swamp_lily_hat.png', buff: <span className="flex items-center justify-center gap-1 text-[#10b981] font-bold">+1 Shiny Feather <img src="/shiny_feather.webp" alt="Shiny Feather" className="w-3.5 h-3.5 drop-shadow-sm" /></span> }
];

const mutants = [
  { name: 'Dumbo Octopus', buff: '20% cơ hội +1 cá khi câu', type: 'Câu cá', image: '/img/sfts/dumbo_octopus.webp' },
  { name: 'Ascended Chicken', buff: '+0.1 Trứng khi thu hoạch gà', type: 'Động vật', image: '/img/sfts/ascended_chicken.webp' },
  { name: 'Ascended Sheep', buff: '+0.1 Lông cừu khi thu hoạch cừu', type: 'Động vật', image: '/img/sfts/ascended_sheep.webp' },
  { name: 'Ascended Cow', buff: '+0.1 Sữa khi thu hoạch bò', type: 'Động vật', image: '/img/sfts/ascended_cow.webp' },
  { name: 'Ruins Flower', buff: '+0.05 Mật ong khi thu hoạch tổ ong', type: 'Hoa', image: '/img/sfts/ruins_flower.webp' }
];

const itemMeta = {
  'Salt Rug': { buff: 'Chưa có thông tin buff (Món mới)', image: <div className="w-8 h-8 rounded bg-pink-900/40 border border-pink-500/30 flex shrink-0 items-center justify-center text-pink-400"><img src="data:image/webp;base64,UklGRsYAAABXRUJQVlA4TLoAAAAvLUAHEBcgEEjyZ91hDYFAkj/lJs///Af8BeDW1t62eQxK6DmENEWy+4QPCpVLHk2BJdA7KWFN/aDDBBH9nwAAVX6E7SWpMp50O52CDJ1yzlkjYJkWQDx2gL9x/x4AOSMeRixTbdB3PJ2w38XTvBAD3hU4VL4u7ao0oB8lym//JAx4mg07VCXvdqOS6l6FZarfVVlPJ2IYWX4Ox85YJgfvGtGBTkA86FFIC4BrkKRbfUcOB90cds7ZAQA=" alt="Salt Rug" className="w-6 h-6 object-contain" /></div> },
  'Coat Rack': { buff: 'Chưa có thông tin buff (Món mới)', image: <div className="w-8 h-8 rounded bg-stone-900/40 border border-stone-500/30 flex shrink-0 items-center justify-center text-stone-400"><img src="data:image/webp;base64,UklGRhYBAABXRUJQVlA4TAkBAAAvEEAGEI/AKLatNpQ9OwYBrBHQbWC6augl0ZDYUBrZaoTFnw3gaJWhADrE5bCZKA0ApGG/QSISecF7rf7hDyYbZgmybSo2+oM9AID//zOJ+B2j6AgtwoxztfqQkMqUurZ3tfdd31IhGq7H52RwGMlWFKGAe7H4yT/cwxhmIvo/AWldgPS0MFQeFNdsyqHeQNbJ43PcqA7NUzluHGoB8nTrKNtJh6U3IjvpsBBTgZwcFq66qJjIhaiX9Ea9+EYiG/V94dtL/pHm+pbLt4Rp9Xozp319SW+Ebqz8euP3JTYdaAAb1N4ITQ8X6akLd2d8Ow2+cS6M1gmEFueqo1/tbOZocc4Ti75IW9cAAA==" alt="Coat Rack" className="w-6 h-6 object-contain" /></div> },
  'Rice Shirt': { buff: '+1 Lúa gạo (Rice)', image: <div className="w-8 h-8 rounded bg-blue-900/40 border border-blue-500/30 flex shrink-0 items-center justify-center text-blue-400"><img src="https://sunflower-land.com/play/wearables/images/413.png" alt="Rice Shirt" className="w-6 h-6 object-contain" /></div> },
  'Vibraphone': { buff: 'x2 thời gian buff của thức ăn', image: <div className="w-8 h-8 rounded bg-amber-900/40 border border-amber-500/30 flex shrink-0 items-center justify-center"><img src="/img/sfts/vibraphone.webp" className="w-6 h-6 object-contain" /></div> },
  'Surfer Hair': { buff: 'Giảm 50% muối khi ủ đồ', image: <div className="w-8 h-8 rounded bg-yellow-900/40 border border-yellow-500/30 flex shrink-0 items-center justify-center"><img src="https://sunflower-land.com/play/wearables/images/586.png" alt="Surfer Hair" className="w-6 h-6 object-contain" /></div> },
  'Alchemist Apron': { buff: 'Giảm 50% phí/thời gian chế Thuốc', image: <div className="w-8 h-8 rounded bg-purple-900/40 border border-purple-500/30 flex shrink-0 items-center justify-center"><img src="https://sunflower-land.com/play/wearables/images/480.png" alt="Alchemist Apron" className="w-6 h-6 object-contain" /></div> },
  'Winged Vase': { buff: '+14% tỉ lệ Prime Aged', image: <div className="w-8 h-8 rounded bg-sky-900/40 border border-sky-500/30 flex shrink-0 items-center justify-center"><img src="/img/sfts/winged_vase.webp" className="w-6 h-6 object-contain" /></div> },
  'Ascended Idol': { buff: 'Thu hoạch Muối MIỄN PHÍ', image: <div className="w-8 h-8 rounded bg-emerald-900/40 border border-emerald-500/30 flex shrink-0 items-center justify-center"><img src="/img/sfts/ascended_idol.webp" className="w-6 h-6 object-contain" /></div> },
  'Salt Worker Gnome': { buff: '+2 Muối & -30% thời gian', image: <div className="w-8 h-8 rounded bg-rose-900/40 border border-rose-500/30 flex shrink-0 items-center justify-center"><img src="/img/sfts/salt_worker_gnome.webp" className="w-6 h-6 object-contain" /></div> },
  'Quarry': { buff: 'Giảm 50% thời gian khai thác Muối', image: <div className="w-8 h-8 rounded bg-orange-900/40 border border-orange-500/30 flex shrink-0 items-center justify-center"><img src="/img/sfts/quarry.webp" alt="Quarry" className="w-6 h-6 object-contain" /></div> },
  "Autumn's Embrace": { buff: 'x0.5 thời gian thu hoạch Plot mùa Thu', image: <div className="w-8 h-8 rounded bg-amber-900/40 border border-amber-500/30 flex shrink-0 items-center justify-center"><img src="https://sunflower-land.com/play/wearables/images/433.png" alt="Autumn's Embrace" className="w-6 h-6 object-contain" /></div> },
  'Pet': { buff: 'NFT Trứng Pet – Có thể nhận pet đặc biệt', image: <div className="w-8 h-8 rounded bg-violet-900/40 border border-violet-500/30 flex shrink-0 items-center justify-center"><img src="/img/icons/pet_nft_egg.png" alt="Pet NFT Egg" className="w-6 h-6 object-contain" /></div> },
  'Tomato Clown': { buff: '+1 Cà chua khi thu hoạch', image: <div className="w-8 h-8 rounded bg-red-900/40 border border-red-500/30 flex shrink-0 items-center justify-center"><img src="/img/sfts/tomato_clown.gif" alt="Tomato Clown" className="w-6 h-6 object-contain" /></div> }
};

const getPhaseInfo = (timestamp) => {
  const d = new Date(timestamp);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 8 || (m === 9 && day < 10)) return { name: 'Giai đoạn 1', res: 'Flowers', icon: flowerIcon, colorClass: 'text-pink-400 bg-pink-900/30 border-pink-500/30' };
  if (m === 9) return { name: 'Giai đoạn 2', res: 'Gems', icon: gemIcon, colorClass: 'text-purple-400 bg-purple-900/30 border-purple-500/30' };
  return { name: 'Giai đoạn 3', res: 'Shiny Feathers', icon: featherIcon, colorClass: 'text-blue-400 bg-blue-900/30 border-blue-500/30' };
};

const AscensionAgePanel = () => {

  const groupedAuctions = useMemo(() => {
    const groups = {};
    const now = Date.now();
    
    detailedAuctions.forEach(a => {
      const start = new Date(a.startAt);
      const end = new Date(a.endAt);
      const dateStr = start.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      
      if (!groups[dateStr]) {
        groups[dateStr] = {
          dateObj: start,
          dateStr,
          items: [],
          phase: getPhaseInfo(a.startAt),
          isActiveToday: false
        };
      }
      
      if (now >= a.startAt && now <= a.endAt) {
        groups[dateStr].isActiveToday = true;
      }
      
      groups[dateStr].items.push({
        ...a,
        startTimeStr: start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }),
        endTimeStr: end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }),
        meta: itemMeta[a.name] || { buff: '', image: <div className="w-8 h-8 rounded bg-slate-800 flex shrink-0 items-center justify-center"><i className="bi bi-box"></i></div> }
      });
    });

    const sortedGroups = Object.values(groups).sort((a, b) => a.dateObj - b.dateObj);
    sortedGroups.forEach(g => {
      g.items.sort((a, b) => a.startAt - b.startAt);
    });

    return sortedGroups;
  }, []);

  const timelineRef = useRef(null);

  useEffect(() => {
    // Auto scroll to today's active drop
    if (timelineRef.current) {
      const activeEl = timelineRef.current.querySelector('.is-active-today');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [groupedAuctions]);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Auctions Panel */}
        <div className="glass-panel h-fit">
          <div className="glass-header bg-gradient-to-r from-amber-900/40 to-yellow-900/40 border-b border-amber-500/30">
            <span className="flex items-center text-amber-300">
              <i className="bi bi-hammer mr-2 text-xl"></i> Auctions
            </span>
          </div>
          <div className="glass-body p-4 space-y-2">
            {[
              { name: 'Salt Rug',          type: 'Collectible', buff: 'Chưa có thông tin buff (Món mới)',              imgSrc: null, imgEl: itemMeta['Salt Rug']?.image },
              { name: 'Coat Rack',         type: 'Collectible', buff: 'Chưa có thông tin buff (Món mới)',              imgSrc: null, imgEl: itemMeta['Coat Rack']?.image },
              { name: 'Rice Shirt',        type: 'Wearable',    buff: '+1 Lúa gạo (Rice)',                            imgSrc: 'https://sunflower-land.com/play/wearables/images/413.png' },
              { name: 'Vibraphone',        type: 'Collectible', buff: 'x2 thời gian buff của thức ăn',                imgSrc: '/img/sfts/vibraphone.webp' },
              { name: 'Surfer Hair',       type: 'Wearable',    buff: 'Giảm 50% muối khi ủ đồ',                      imgSrc: 'https://sunflower-land.com/play/wearables/images/586.png' },
              { name: 'Alchemist Apron',   type: 'Wearable',    buff: 'Giảm 50% phí/thời gian chế Thuốc',            imgSrc: 'https://sunflower-land.com/play/wearables/images/480.png' },
              { name: 'Winged Vase',       type: 'Collectible', buff: '+14% tỉ lệ Prime Aged',                        imgSrc: '/img/sfts/winged_vase.webp' },
              { name: 'Ascended Idol',     type: 'Collectible', buff: 'Thu hoạch Muối MIỄN PHÍ',                      imgSrc: '/img/sfts/ascended_idol.webp' },
              { name: 'Salt Worker Gnome', type: 'Collectible', buff: '+2 Muối & -30% thời gian khai thác',           imgSrc: '/img/sfts/salt_worker_gnome.webp' },
              { name: 'Quarry',            type: 'Collectible', buff: 'Giảm 50% thời gian khai thác Muối',            imgSrc: '/img/sfts/quarry.webp' },
              { name: "Autumn's Embrace",  type: 'Wearable',    buff: 'x0.5 thời gian thu hoạch Plot mùa Thu',        imgSrc: 'https://sunflower-land.com/play/wearables/images/433.png' },
              { name: 'Tomato Clown',      type: 'Collectible', buff: '+1 Cà chua khi thu hoạch',                     imgSrc: '/img/sfts/tomato_clown.gif' },
              { name: 'Pet',               type: 'NFT',         buff: 'NFT Trứng Pet – Có thể nhận pet đặc biệt',     imgSrc: '/img/icons/pet_nft_egg.png' },
            ].map((item, idx) => {
              const typeColors = {
                'Collectible': 'bg-sky-900/30 text-sky-400 border-sky-500/30',
                'Wearable':    'bg-violet-900/30 text-violet-400 border-violet-500/30',
                'NFT':         'bg-amber-900/30 text-amber-400 border-amber-500/30',
              };
              const imgNode = item.imgEl
                ? <div className="w-10 h-10 rounded-lg bg-slate-700/60 border border-slate-600/50 flex shrink-0 items-center justify-center overflow-hidden">{item.imgEl}</div>
                : (item.imgSrc
                    ? <div className="w-10 h-10 rounded-lg bg-slate-700/60 border border-slate-600/50 flex shrink-0 items-center justify-center"><img src={item.imgSrc} alt={item.name} className="w-8 h-8 object-contain" /></div>
                    : <div className="w-10 h-10 rounded-lg bg-slate-700/60 border border-slate-600/50 flex shrink-0 items-center justify-center text-slate-500"><i className="bi bi-box text-sm"></i></div>);
              return (
                <div key={idx} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 shadow-sm flex items-center gap-3 hover:border-amber-500/30 transition-colors group">
                  {imgNode}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-200 text-sm group-hover:text-amber-300 transition-colors leading-tight">{item.name}</div>
                    <div className="text-[11px] text-emerald-400 mt-0.5 leading-tight">{item.buff}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider whitespace-nowrap shrink-0 border ${typeColors[item.type] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>{item.type}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stella's Megastore */}
        <div className="glass-panel h-fit">
          <div className="glass-header bg-gradient-to-r from-pink-900/40 to-purple-900/40 border-b border-pink-500/30">
            <span className="flex items-center text-pink-300">
              <i className="bi bi-shop mr-2 text-xl"></i> Stella's Megastore
            </span>
          </div>
          <div className="glass-body p-4 space-y-2">
            {megastoreItems.map((item, idx) => (
              <div key={idx} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 shadow-sm flex items-center gap-3 hover:border-pink-500/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-slate-700/60 border border-slate-600/50 flex shrink-0 items-center justify-center overflow-hidden">
                  {item.image && <img src={item.image} alt={item.name} className="w-8 h-8 object-contain" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-200 text-sm group-hover:text-pink-300 transition-colors leading-tight">{item.name}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5 leading-tight">{item.buff}</div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="bg-slate-900/60 px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 border border-slate-700">
                    {item.icon} {item.cost} {item.type}
                  </div>
                  {item.hasVipDiscount && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/50 rounded text-[9px] uppercase font-bold" title="Giảm 50% nếu có thẻ VIP">VIP -50%</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mutants & Gameplay Drops */}
        <div className="glass-panel h-fit">
          <div className="glass-header bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-b border-emerald-500/30">
            <span className="flex items-center text-emerald-300">
              <i className="bi bi-stars mr-2 text-xl"></i> Mutants & Gameplay
            </span>
          </div>
          <div className="glass-body p-4 space-y-2">
            {mutants.map((item, idx) => (
              <div key={idx} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50 shadow-sm flex items-center gap-3 hover:border-emerald-500/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-slate-700/60 border border-slate-600/50 flex shrink-0 items-center justify-center overflow-hidden">
                  {item.image && <img src={item.image} alt={item.name} className="w-8 h-8 object-contain drop-shadow-md" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-200 text-sm group-hover:text-emerald-300 transition-colors leading-tight">{item.name}</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5 leading-tight">{item.buff}</div>
                </div>
                <span className="bg-emerald-900/30 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider whitespace-nowrap shrink-0">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lịch Đấu Giá Mới */}

      <div className="glass-panel">
        <div className="glass-header bg-gradient-to-r from-amber-900/40 to-orange-900/40 border-b border-amber-500/30 flex justify-between items-center">
          <span className="flex items-center text-amber-400">
            <i className="bi bi-calendar2-week mr-2 text-xl"></i> Chi tiết Lịch Đấu Giá
          </span>
          <span className="text-xs text-amber-200/70 bg-black/20 px-2 py-1 rounded border border-amber-900/30">Hiển thị theo GMT+7</span>
        </div>
        <div className="glass-body p-6 max-h-[600px] overflow-y-auto custom-scrollbar" ref={timelineRef}>
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
            {groupedAuctions.map((group, idx) => (
              <div key={idx} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group ${group.isActiveToday ? 'is-active-today' : ''}`}>
                
                {/* Timeline Dot */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${group.isActiveToday ? 'bg-amber-900 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-slate-900 text-slate-500 border-slate-700 group-hover:text-amber-500 group-hover:border-amber-500'} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors z-10`}>
                  <i className="bi bi-calendar-event"></i>
                </div>
                
                {/* Card */}
                <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border ${group.isActiveToday ? 'border-amber-500/50 bg-amber-900/20' : 'border-slate-700/50 bg-slate-800/60 hover:border-amber-500/30'} shadow transition-colors`}>
                  
                  {/* Card Header (Date & Phase) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
                    <span className={`font-black text-lg ${group.isActiveToday ? 'text-amber-400' : 'text-slate-200'}`}>{group.dateStr}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-1 rounded-md border ${group.phase.colorClass} shadow-sm whitespace-nowrap flex items-center gap-1 font-semibold`}>
                        {group.phase.name} ({group.phase.icon})
                      </span>
                    </div>
                  </div>

                  {/* Drop Items List */}
                  <div className="space-y-2">
                    {group.items.map((item, itemIdx) => {
                      const isNow = Date.now() >= item.startAt && Date.now() <= item.endAt;
                      return (
                        <div key={itemIdx} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm bg-slate-900/50 p-3 rounded-lg border ${isNow ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)] relative overflow-hidden' : 'border-slate-700/50'}`}>
                          {isNow && <div className="absolute inset-0 bg-emerald-500/10 animate-pulse pointer-events-none"></div>}
                          
                          <div className="flex items-center gap-3">
                            {item.meta.image}
                            <div>
                              <div className="font-bold text-slate-200 flex items-center gap-2">
                                {item.name}
                                {isNow && <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider animate-bounce">Đang diễn ra</span>}
                              </div>
                              <div className="text-xs text-slate-400">{item.meta.buff}</div>
                            </div>
                          </div>

                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0">
                            <div className="bg-slate-950/60 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono inline-flex items-center gap-1.5 shadow-inner">
                              <i className="bi bi-clock text-slate-500"></i> {item.startTimeStr} - {item.endTimeStr}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              Supply: <span className="text-emerald-400 font-bold font-mono">{item.supply}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AscensionAgePanel;
