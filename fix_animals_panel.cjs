const fs = require('fs');

const path = 'src/components/AnimalsPanel.jsx';
let code = fs.readFileSync(path, 'utf8');

const targetRegex = /<div className="glass-body">[\s\S]*?<button/m;
const replacement = `<div className="glass-body">
        {/* Animals Summary */}
        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 mb-4 grid grid-cols-2 gap-3 text-center divide-x divide-slate-700/50 shadow-inner text-[10px] md:text-xs">
          <div className="px-2 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tiến độ</div>
            <div className="text-lg font-black text-emerald-400">
              {animals.filter(a => a.status === 'claimed').length} / {animals.length}
            </div>
          </div>
          <div className="px-2 flex flex-col justify-center">
            <div className="text-slate-400 font-bold uppercase tracking-wider mb-1">Tổng Tickets</div>
            <div className="text-xl font-black text-yellow-400 flex items-center justify-center">
              {animals.reduce((sum, a) => sum + (a.reward || 0), 0)} <img src="/shiny_feather.webp" className="w-5 h-5 ml-1.5 drop-shadow-sm" alt="Feather" />
            </div>
          </div>
        </div>

        <button`;

if (targetRegex.test(code)) {
    code = code.replace(targetRegex, replacement);
    fs.writeFileSync(path, code);
    console.log("Updated AnimalsPanel.jsx");
} else {
    console.log("Could not find target in AnimalsPanel.jsx");
}
