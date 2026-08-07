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
    <div className="w-full mt-12 mb-8 animate-fade-in-up">
      <div className="glass-panel p-6 max-w-2xl mx-auto flex flex-col sm:flex-row items-center gap-6 border border-amber-500/30 bg-slate-800/60 shadow-lg relative overflow-hidden group">
        
        {/* Lớp nền lấp lánh nhẹ */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -translate-x-full group-hover:translate-x-full"></div>

        {/* Cột trái: Ảnh NPC khóc lóc/mệt mỏi */}
        <div className="relative shrink-0 w-24 h-24 rounded-2xl bg-slate-900 border-2 border-amber-500/40 p-2 flex items-center justify-center shadow-inner overflow-hidden">
           {/* Ảnh bumpkin của Dev hoặc Goblin - dùng ảnh Bumpkin của Dev */}
           <img 
              src="https://animations.sunflower-land.com/bumpkin_image/0_v1_32_90_52_282_234_89_240_424_0_228_0_562_0_374_0_0_559/100" 
              alt="Crying Dev" 
              className="w-full h-full object-contain drop-shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
           />
           {/* Emotion icon (Crying) */}
           <div className="absolute -top-1 -right-1 text-2xl animate-bounce-slow drop-shadow-lg">
             😭
           </div>
        </div>

        {/* Cột phải: Nội dung & Copy */}
        <div className="flex-1 text-center sm:text-left z-10">
          <h3 className="text-xl font-bold text-amber-400 mb-2 flex items-center justify-center sm:justify-start gap-2">
            Ủng hộ Dev ly cà phê ☕
          </h3>
          <p className="text-sm text-slate-300 mb-4 leading-relaxed">
            Xài tool mượt, chốt lời ngon thì đừng quên người đứng sau bàn phím nhé! Quăng nhẹ vài đồng MATIC/SFL mời Dev ly cà phê để lấy động lực update thêm nhiều tính năng xịn xò cho anh em. 😎
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <code className="bg-slate-900/80 px-3 py-2 rounded-lg text-xs text-indigo-300 font-mono border border-slate-700 w-full sm:w-auto truncate selection:bg-indigo-500/30">
              {walletAddress}
            </code>
            <button 
              onClick={handleCopy}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all w-full sm:w-auto flex items-center justify-center gap-2 border ${copied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border-indigo-500/50 hover:scale-105'}`}
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
