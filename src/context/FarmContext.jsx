import React, { createContext, useState, useContext, useEffect, useRef } from 'react';

const FarmContext = createContext();

export const FarmProvider = ({ children }) => {
  const [farmData, setFarmData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentId, setCurrentId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  
  const [queueInfo, setQueueInfo] = useState(null);
  const [searchSuccess, setSearchSuccess] = useState(false);
  const queueIntervalRef = useRef(null);
  const searchInProgress = useRef(false);

  // Auto-fetch if ID exists in LocalStorage
  useEffect(() => {
    const savedId = localStorage.getItem('sfl_farm_id');
    if (savedId) {
      handleSearch(savedId, true);
    }
  }, []);

  const handleSearch = async (searchId, forceUpdate = false) => {
    if (!searchId) return;
    if (searchInProgress.current) return;
    
    searchInProgress.current = true;
    setLoading(true);
    setError(null);
    setQueueInfo(null);
    
    // Start polling queue status
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    queueIntervalRef.current = setInterval(async () => {
      try {
        const qRes = await fetch(`${apiUrl}/api/system/queue-status`);
        if (qRes.ok) {
          const qData = await qRes.json();
          if (qData.success && qData.data) {
            setQueueInfo(qData.data);
          }
        }
      } catch (err) {}
    }, 1000);
    try {
      const farmId = searchId.toString();
      setCurrentId(farmId);
    
    // Save to LocalStorage
    localStorage.setItem('sfl_farm_id', farmId);
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      // 1. Always login to get/verify token
      const loginRes = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmId })
      });
      
      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(loginData.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại Farm ID!');
      }
      
      localStorage.setItem('sfl_token', loginData.token);

      // 2. Fetch farm data using token
      const token = localStorage.getItem('sfl_token');
      if (!token) {
         throw new Error('UNAUTHORIZED');
      }

      const fetchUrl = forceUpdate ? `${apiUrl}/api/farm/${farmId}?force=true` : `${apiUrl}/api/farm/${farmId}`;
      const res = await fetch(fetchUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('sfl_token');
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(data.error || data.message || 'Failed to fetch data');
      }
      
      setFarmData(data.data);
      setAnalyticsRefreshKey(prev => prev + 1);
      
      // Bật trạng thái thành công trong 2 giây
      setSearchSuccess(true);
      setTimeout(() => {
        setSearchSuccess(false);
      }, 2000);
      
    } catch (err) {
      setFarmData(null);
      if (err.message === 'Failed to fetch') {
        setError('Không thể kết nối đến máy chủ Backend hoặc Database. Vui lòng kiểm tra lại kết nối mạng hoặc chắc chắn server đang chạy.');
      } else if (err.message === 'UNAUTHORIZED') {
        setError('Phiên đăng nhập hết hạn hoặc chưa đăng nhập.');
        localStorage.removeItem('sfl_token');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      searchInProgress.current = false;
      if (queueIntervalRef.current) {
        clearInterval(queueIntervalRef.current);
        queueIntervalRef.current = null;
      }
      setQueueInfo(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sfl_farm_id');
    localStorage.removeItem('sfl_token');
    setFarmData(null);
    setCurrentId('');
    setError(null);
  };

  return (
    <FarmContext.Provider 
      value={{ 
        farmData, 
        loading, 
        queueInfo,
        searchSuccess,
        error, 
        currentId, 
        activeTab, 
        setActiveTab, 
        analyticsRefreshKey, 
        setAnalyticsRefreshKey,
        handleSearch,
        handleLogout
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = () => useContext(FarmContext);
