const fs = require('fs');

const path = 'src/components/DeliveriesPanel.jsx';
let code = fs.readFileSync(path, 'utf8');

const targetRegex = /<div className="glass-body">[\s\S]*?<div className="flex justify-between items-center mb-4">/m;
const replacement = `<div className="glass-body">
        {/* Deliveries Summary */}
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-2 text-center md:divide-x divide-y md:divide-y-0 divide-slate-700/50 shadow-inner text-[10px] md:text-xs">
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tiến độ</div>
            <div className="text-lg font-black text-emerald-400">
              {totalClaimed} / {ticketDeliveries.length}
            </div>
          </div>
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center border-t-0">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Tickets</div>
            <div className="text-xl font-black text-yellow-400 flex items-center justify-center">
              {totalTickets} <img src="/shiny_feather.webp" className="w-5 h-5 ml-1.5 drop-shadow-sm" alt="Feather" />
            </div>
          </div>
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Chi Phí P2P</div>
            <div className="text-lg font-black text-rose-400">
              {totalCostP2P} <span className="text-[10px] text-rose-400/70 font-normal">SFL</span>
            </div>
          </div>
          <div className="px-2 py-2 md:py-0 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Chi phí trung bình</div>
            <div className="text-lg font-black text-indigo-300">
              {totalTickets > 0 ? (parseFloat(totalCostP2P) / totalTickets).toFixed(2) : '0.00'} <span className="text-[10px] text-indigo-300/70 font-normal">SFL/vé</span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">`;

if (targetRegex.test(code)) {
    code = code.replace(targetRegex, replacement);
    fs.writeFileSync(path, code);
    console.log("Updated DeliveriesPanel.jsx");
} else {
    console.log("Could not find target in DeliveriesPanel.jsx");
}
