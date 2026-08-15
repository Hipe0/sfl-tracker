import React, { useEffect, useState } from 'react';

const ProgressRing = ({ queueInfo, loading }) => {
  const [progress, setProgress] = useState(0);
  const startTimeRef = React.useRef(null);
  const durationRef = React.useRef(6000);

  useEffect(() => {
    if (!loading) {
      setProgress(100);
      startTimeRef.current = null;
      durationRef.current = 6000;
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
      setProgress(0);
    }

    // API tổng hợp mất trung bình khoảng 5-6 giây do phải gọi 7 endpoint khác nhau
    // Nếu có xếp hàng thì cộng thêm thời gian xếp hàng.
    if (queueInfo && queueInfo.sflCommunity) {
      const commWait = queueInfo.sflCommunity.waiting;
      const commDelay = queueInfo.sflCommunity.delayMs;
      
      const worldWait = queueInfo.sflWorld ? queueInfo.sflWorld.waiting : 0;
      const worldDelay = queueInfo.sflWorld ? queueInfo.sflWorld.delayMs : 0;

      if (commWait > 0 || worldWait > 0) {
        // Cộng 6000ms (thời gian cơ bản) + thời gian chờ queue
        const est = 6000 + (commWait * commDelay) + Math.ceil(worldWait / 6) * worldDelay;
        if (est > durationRef.current) {
          durationRef.current = est;
        }
      }
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      let currentProgress = (elapsed / durationRef.current) * 100;

      // Giữ lại ở 95% nếu backend chưa phản hồi xong
      if (currentProgress > 95) currentProgress = 95;

      setProgress(currentProgress);
    }, 100);

    return () => clearInterval(interval);
  }, [queueInfo, loading]);

  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 20 20" 
      className="transform -rotate-90 inline-block shrink-0"
    >
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="currentColor"
        strokeWidth="2.5"
        fill="transparent"
        className="opacity-20"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="currentColor"
        strokeWidth="2.5"
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="transition-all duration-100 ease-linear text-white drop-shadow-md"
      />
    </svg>
  );
};

export default ProgressRing;
