import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Gọi 1 hàm lấy dữ liệu, tự chạy lại khi deps đổi. Giữ dữ liệu cũ khi đang tải lại để giao diện không nháy trắng.
 */
export function useApi(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setState(s => ({ ...s, loading: true }));
    try {
      const data = await fn();
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState(s => ({ data: s.data, error, loading: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
