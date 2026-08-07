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
    <div className="w-full mt-10 mb-6 animate-fade-in-up">
      <div className="glass-panel p-5 max-w-lg mx-auto flex flex-col items-center gap-4 border border-amber-500/30 bg-slate-800/70 shadow-lg relative overflow-hidden group rounded-xl">
        
        {/* Lớp nền lấp lánh nhẹ */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -translate-x-full group-hover:translate-x-full"></div>

        {/* Nội dung & Copy */}
        <div className="flex-1 text-center z-10 w-full">
          <h3 className="text-lg font-bold text-amber-400 mb-2 flex items-center justify-center gap-2">
            Hành trình làm dev của gaconlonton
          </h3>
          <p className="text-xs text-slate-300 mb-4 leading-relaxed">
            Bumpkin nhà bạn thì ăn bánh ăn mứt, còn Bumpkin của Dev thì đang húp mì tôm. Thấy thương thì quăng nhẹ vài đồng SFL/MATIC vào mặt Dev nhé, hứa sẽ không đem tiền nạp game đâu, chỉ ún cf thoi 😄
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <code className="bg-slate-900/80 px-3 py-1.5 rounded-lg text-xs text-indigo-300 font-mono border border-slate-700 selection:bg-indigo-500/30">
              {walletAddress}
            </code>
            <button 
              onClick={handleCopy}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${copied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-500/50 hover:scale-105'}`}
            >
              {copied ? (
                <><i className="bi bi-check2-all text-sm"></i> Đã chép! Cảm ơn sếp ❤️</>
              ) : (
                <><i className="bi bi-clipboard text-sm"></i> Copy Ví</>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DonationFooter;
