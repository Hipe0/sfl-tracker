import React from 'react';
import { useFarm } from '../context/FarmContext';

const SummaryPanel = () => {
  const { farmData } = useFarm();
  const summary = farmData?.summary;
  if (!summary) return null;

  return (
    <div className="glass-panel">
      <div className="glass-header">
        <span><i className="bi bi-bar-chart-fill mr-2 text-blue-400"></i>Summary</span>
      </div>
      <div className="glass-body">
        {summary.dailyChest && (
          <div className={`status-card ${summary.dailyChest.status === 'success' ? 'status-success' : 'status-danger'}`}>
            <span className="font-semibold text-white text-sm"><i className="bi bi-check2-circle mr-2"></i>Daily chest</span>
            <span className="text-sm">{summary.dailyChest.text}</span>
          </div>
        )}
        
        {summary.desertDigging && (
          <div className={`status-card ${summary.desertDigging.status === 'success' ? 'status-success' : 'status-danger'}`}>
            <span className="font-semibold text-white text-sm"><i className="bi bi-check2-circle mr-2"></i>Desert Digging</span>
            <span className="text-sm">{summary.desertDigging.text}</span>
          </div>
        )}
        
        {summary.poppyBounty && (
          <div className={`status-card ${summary.poppyBounty.status === 'danger' ? 'status-danger' : 'status-success'}`}>
            <span className="font-semibold text-white text-sm"><i className="bi bi-ban mr-2"></i>Poppy Bounty Bonus</span>
            <span className="text-sm">{summary.poppyBounty.text}</span>
          </div>
        )}
        
        {summary.table && summary.table.length > 0 && (
          <div className="mt-5 bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
            <table className="w-full text-xs md:text-sm text-left">
              <thead className="bg-slate-800/80 text-slate-300">
                <tr>
                  <th className="py-3 px-3 font-semibold">Source</th>
                  <th className="py-3 px-2 font-semibold text-center">Total</th>
                  <th className="py-3 px-2 font-semibold text-center">Claimed</th>
                  <th className="py-3 px-2 font-semibold text-center">Left</th>
                  <th className="py-3 px-3 font-semibold text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {summary.table.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-700/20 transition-colors">
                    <td className="py-3 px-3 font-medium text-slate-200">{row.source}</td>
                    <td className="py-3 px-2 text-center text-slate-300">{row.total}</td>
                    <td className="py-3 px-2 text-center text-emerald-400 font-medium">{row.claimed}</td>
                    <td className="py-3 px-2 text-center text-amber-400 font-medium">{row.left}</td>
                    <td className="py-3 px-3 text-right text-slate-400">{row.percent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SummaryPanel;
