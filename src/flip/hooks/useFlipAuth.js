import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

// Dùng chung khoá với FlipPanel để bảng lãi/lỗ tự mở khoá theo
const KEY_STORAGE = 'sfl_flip_key';

const readKey = () => {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
};
const writeKey = value => {
  try {
    if (value) localStorage.setItem(KEY_STORAGE, value);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* trình duyệt chặn storage: chỉ giữ trong phiên này */ }
};

/**
 * Đăng nhập FLIP bằng mã truy cập. Người dùng bắt buộc đăng ký bằng API key SFL của họ để có mã.
 * status: 'checking' | 'locked' | 'ready'
 */
export function useFlipAuth() {
  const [key, setKey] = useState(readKey);
  const [access, setAccess] = useState(null);
  const [status, setStatus] = useState(() => (readKey() ? 'checking' : 'locked'));
  const [error, setError] = useState(null);

  const lock = useCallback(() => {
    writeKey('');
    setKey('');
    setAccess(null);
    setStatus('locked');
  }, []);

  const unlock = useCallback(async value => {
    const code = (value || '').trim();
    if (!code) return false;
    setStatus('checking');
    setError(null);
    try {
      const data = await api.status(code);
      writeKey(code);
      setKey(code);
      setAccess(data);
      setStatus('ready');
      return true;
    } catch (e) {
      if (e.status === 404) {
        writeKey('');
        setKey('');
        setError('Mã không đúng hoặc đã bị huỷ. Đăng ký lại bằng API key của bạn.');
      } else {
        setError(e.message);
      }
      setStatus('locked');
      return false;
    }
  }, []);

  useEffect(() => {
    if (key) unlock(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { key, access, status, error, unlock, lock, refreshAccess: () => unlock(key) };
}
