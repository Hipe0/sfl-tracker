const fs = require('fs');

let delUi = fs.readFileSync('src/components/DeliveriesPanel.jsx', 'utf-8');

const searchTarget = `            } else if (del.status === 'ready') {
              statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
              statusColor = 'from-amber-900/30 to-slate-800/40 border-amber-500/30';
            } else {
              statusBadge = 'bg-slate-700 text-slate-400';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
            }`;

const replacement = `            } else if (del.status === 'ready') {
              statusBadge = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
              statusColor = 'from-amber-900/30 to-slate-800/40 border-amber-500/30';
            } else if (del.status === 'can_skip') {
              statusBadge = 'bg-slate-700 text-slate-300 border-slate-600';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
              del.statusText = 'Có thể Skip';
            } else {
              statusBadge = 'bg-slate-700 text-slate-400';
              statusColor = 'bg-slate-800/60 border-slate-700/50';
            }`;

delUi = delUi.replace(searchTarget, replacement);
delUi = delUi.replace(/del\.status === 'ready' \? 'Ready' : 'Not Ready'/g, "del.status === 'ready' ? 'Ready' : (del.statusText || 'Not Ready')");
delUi = delUi.replace(/statusBadge = 'bg-emerald-500\/20 text-emerald-400 border border-emerald-500\/30';/g, "statusBadge = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';\n              del.statusText = 'Đã giao';");

fs.writeFileSync('src/components/DeliveriesPanel.jsx', delUi);
