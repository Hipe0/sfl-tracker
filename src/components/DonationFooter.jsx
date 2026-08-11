import React, { useState } from 'react';

const DonationFooter = () => {
  const [copied, setCopied] = useState(false);
  const walletAddress = "0x2e813473f3b747704a3b2c7616f4148a1dd9701c";

  const handleCopy = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center gap-1.5 bg-slate-800/40 px-4 py-2.5 rounded-xl border border-amber-500/30 shadow-sm relative group max-w-[600px]">
        
        <div className="text-[11px] text-slate-300 text-center leading-relaxed px-2">
          <strong className="text-amber-400">SFL Tracker</strong> là dự án phi lợi nhuận được phát triển bởi <strong className="text-indigo-300">gaconlontonn</strong>. Nếu thấy hữu ích, bạn có thể giúp anh ấy bằng 1 lượt Cheer/Help, hoặc Donate để duy trì máy chủ nhé! ❤️
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {/* Wallet */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 pl-2.5 pr-1 py-1 rounded-lg border border-slate-700/50">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Crypto</span>
            <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px] text-indigo-300 font-mono border border-slate-700/50">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </code>
            <button 
              onClick={handleCopy}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all flex items-center gap-1 ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30'}`}
              title="Copy Wallet Address"
            >
              {copied ? <><i className="bi bi-check2"></i> OK</> : <><i className="bi bi-clipboard"></i> Copy</>}
            </button>
          </div>

          {/* In-game */}
          <div className="flex items-center gap-1.5 bg-slate-900/60 pl-2.5 pr-1 py-1 rounded-lg border border-slate-700/50">
            <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
              <span>In-game</span>
              <img src="data:image/webp;base64,UklGRroAAABXRUJQVlA4TK4AAAAvEAAEEEegGAAaKIQE8ui///wVToZpqAkANOEjDYGo6hJrqqiRFOY0YAybmOvty/wHAP7/ohOLMeAkJSsj0Qg4biTbiUZ6ETxMAKy5P+n/D1zRfxsBNgI2AHv2+/N+BBHR/wmAFefISFTdyFkHI8zdaPJOnyNBHBfVZyHEnIvdt4UMJR9NHJmXMRH6kGtKLSDnqCkRcJn0k1psuMVtjPXozbrOJzKPR+8BwDknZAA=" alt="Cheer" className="w-3.5 h-3.5 object-contain" />
            </div>
            <code className="bg-slate-800/80 px-1.5 py-0.5 rounded text-[10px] text-amber-300 font-mono border border-slate-700/50">
              6279470157500012
            </code>
            <button 
              onClick={() => {
                navigator.clipboard.writeText("6279470157500012");
                alert("Đã copy Farm ID: 6279470157500012");
              }}
              className="px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30"
              title="Copy Farm ID"
            >
              <i className="bi bi-clipboard"></i> Copy
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DonationFooter;
