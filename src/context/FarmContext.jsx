import React, { createContext, useState, useContext, useEffect } from 'react';

const FarmContext = createContext();

export const FarmProvider = ({ children }) => {
  const [farmData, setFarmData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentId, setCurrentId] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);

  // Auto-fetch if ID exists in LocalStorage
  useEffect(() => {
    const savedId = localStorage.getItem('sfl_farm_id');
    if (savedId) {
      handleSearch(savedId, true);
    }
  }, []);

  const handleSearch = async (searchId, forceUpdate = false) => {
    if (!searchId) return;
    
    setLoading(true);
    setError(null);
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
        throw new Error(loginData.message || 'Sai Farm ID hoặc không nằm trong danh sách quản lý!');
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
