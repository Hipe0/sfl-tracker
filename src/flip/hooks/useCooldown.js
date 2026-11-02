import { useCallback, useEffect, useState } from 'react';

const STORAGE = 'sfl_flip_sync_until';

const readUntil = () => {
  try { return Number(sessionStorage.getItem(STORAGE)) || 0; } catch { return 0; }
};

/**
 * Đếm ngược chống bấm liên tục. Lưu mốc vào sessionStorage để tải lại trang cũng không lách được.
 */
export function useCooldown() {
  const [until, setUntil] = useState(readUntil);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (until <= Date.now()) return undefined;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [until]);

  const start = useCallback(ms => {
    const value = Date.now() + ms;
    try { sessionStorage.setItem(STORAGE, String(value)); } catch { /* bỏ qua */ }
    setUntil(value);
    setNow(Date.now());
  }, []);

  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  return { remaining, active: remaining > 0, start };
}
