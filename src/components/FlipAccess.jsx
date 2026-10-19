import React, { useState, useEffect } from 'react';

// Lỗi đăng ký / đổi key trả về từ server
const ERRORS = {
  INVALID: 'Kiểm tra lại Farm ID và API key',
  INVALID_KEY: 'API key không đúng hoặc đã bị thu hồi',
  FARM_TAKEN: 'Farm này đã được đăng ký bằng một API key khác. Nhập đúng key cũ để lấy lại mã',
  OWNER_FARM: 'Farm này do chủ app quản lý, không đăng ký được',
  REGISTRATION_DISABLED: 'Chủ app chưa bật đăng ký FLIP',
  TOO_MANY_ATTEMPTS: 'Thử quá nhiều lần, vui lòng đợi một lúc',
  FULL: 'FLIP đã đủ người dùng',
  SFL_UNAVAILABLE: 'Không gọi được API Sunflower Land, thử lại sau'
};

const errorText = data => ERRORS[data?.error] || data?.message || data?.error || 'Có lỗi xảy ra';

function Button({ active, onClick, children, type = 'button', disabled, C }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1 text-[11px] font-mono uppercase tracking-wider border rounded-sm disabled:opacity-50"
      style={{
        borderColor: active ? C.red : '#3a3f48',
        color: active ? C.red : C.muted,
        background: active ? 'rgba(255,77,109,0.08)' : 'transparent'
      }}
    >
      {children}
    </button>
  );
}

const inputClass = 'px-3 py-1.5 text-sm text-white rounded-sm border outline-none';
const inputStyle = { background: '#07080b', borderColor: '#3a3f48' };

/**
 * Lối vào FLIP khi chưa mở khoá: nhập mã đã có, hoặc tự đăng ký bằng Farm ID + API key SFL
 */
export function FlipGate({ farmId, apiUrl, onUnlock, keyError, forceOpen, wrongFarms, onLock, C }) {
  const [info, setInfo] = useState(null); // null = server không bật FLIP
  const [mode, setMode] = useState(forceOpen ? 'code' : null);
  const [code, setCode] = useState('');
  const [regFarm, setRegFarm] = useState(farmId || '');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [issued, setIssued] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${apiUrl}/api/flip/public`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (alive) setInfo(data?.success ? data.data : null); })
      .catch(() => { if (alive) setInfo(null); });
    return () => { alive = false; };
  }, [apiUrl]);

  useEffect(() => { if (forceOpen) setMode(m => m || 'code'); }, [forceOpen]);
  useEffect(() => { setRegFarm(farmId || ''); }, [farmId]);

  if (!info && !forceOpen) return null;

  const register = async e => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/flip/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ farmId: regFarm.trim(), apiKey: apiKey.trim() })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(errorText(data));
      setApiKey('');
      setIssued(data.data.code);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="font-mono rounded-sm border p-4 space-y-3" style={{ background: C.bg, borderColor: C.border, color: C.text }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-white font-bold"><span style={{ color: C.red }}>&gt;</span> FLIP</div>
          <div className="text-[11px]" style={{ color: C.muted }}>
            Lãi/lỗ lướt sóng theo FIFO, tự lưu giao dịch của farm bạn mỗi phút
          </div>
        </div>
        <div className="flex gap-2">
          {info?.registration && <Button active={mode === 'register'} onClick={() => setMode(mode === 'register' ? null : 'register')} C={C}>Đăng ký</Button>}
          <Button active={mode === 'code'} onClick={() => setMode(mode === 'code' ? null : 'code')} C={C}>Đã có mã</Button>
        </div>
      </div>

      {wrongFarms && (
        <div className="text-xs" style={{ color: C.amber }}>
          Mã đang lưu trên trình duyệt này dành cho farm {wrongFarms.join(', ')}.{' '}
          <button type="button" className="underline" onClick={onLock}>Xoá mã</button> để dùng mã khác.
        </div>
      )}

      {issued && (
        <div className="text-xs space-y-2 p-3 border rounded-sm" style={{ borderColor: C.amber }}>
          <div style={{ color: C.amber }}>Đăng ký xong. Đây là mã truy cập FLIP của bạn, hãy lưu lại để dùng trên máy khác:</div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="px-2 py-1 text-white break-all" style={{ background: '#07080b' }}>{issued}</code>
            <Button onClick={() => navigator.clipboard?.writeText(issued)} C={C}>Copy</Button>
            <Button active onClick={() => onUnlock(issued)} C={C}>Mở FLIP</Button>
          </div>
        </div>
      )}

      {mode === 'code' && !issued && (
        <form onSubmit={e => { e.preventDefault(); onUnlock(code.trim()); }} className="flex flex-wrap items-center gap-2">
          <input type="password" value={code} onChange={e => setCode(e.target.value)} placeholder="Mã truy cập FLIP"
            className={`${inputClass} w-full sm:w-80`} style={inputStyle} autoComplete="off" />
          <Button type="submit" active C={C}>Mở khoá</Button>
          {keyError && <span className="text-xs" style={{ color: C.red }}>{keyError}</span>}
        </form>
      )}

      {mode === 'register' && !issued && (
        <form onSubmit={register} className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[10px]" style={{ color: C.muted }}>
              Farm ID
              <input value={regFarm} onChange={e => setRegFarm(e.target.value)} className={`${inputClass} w-48`} style={inputStyle} required />
            </label>
            <label className="flex flex-col gap-1 text-[10px] flex-1 min-w-[220px]" style={{ color: C.muted }}>
              API key Sunflower Land
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className={inputClass} style={inputStyle} autoComplete="off" required />
            </label>
            <Button type="submit" active disabled={busy} C={C}>{busy ? 'Đang kiểm tra...' : 'Đăng ký'}</Button>
          </div>
          <div className="text-[11px] leading-relaxed" style={{ color: C.muted }}>
            Key chỉ dùng để đọc lịch sử giao dịch và kho đồ của farm này, được mã hoá trên server và không hiện lại ở đâu.
            Bạn đổi key trong game bất cứ lúc nào thì nhập key mới ở mục Tài khoản. Lịch sử chỉ bắt đầu đủ từ lúc đăng ký
            (API chỉ trả 50 giao dịch gần nhất).
          </div>
          {error && <div className="text-xs" style={{ color: C.red }}>{error}</div>}
        </form>
      )}
    </div>
  );
}

/**
 * Tài khoản người dùng tự đăng ký: xem key (4 ký tự cuối), đổi key, huỷ đăng ký
 */
export function FlipAccount({ account, flipFetch, onChanged, onUnregistered, C }) {
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  if (!account) return null;

  const updateKey = async e => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await flipFetch('/me/key', { method: 'PUT', body: { apiKey: apiKey.trim() } });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(errorText(data));
      setApiKey('');
      setMessage({ ok: true, text: 'Đã cập nhật key, hệ thống lấy giao dịch lại ngay' });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const unregister = async () => {
    if (!window.confirm('Huỷ đăng ký FLIP? Server xoá API key và mã truy cập của bạn, ngừng lưu giao dịch.')) return;
    const res = await flipFetch('/me', { method: 'DELETE' });
    if (res.ok) onUnregistered();
  };

  return (
    <div className="px-4 py-3 border-b text-xs space-y-2" style={{ borderColor: C.border, background: '#0e1015' }}>
      <div style={{ color: C.muted }}>
        Farm {account.farmId} · API key ••••{account.keyLast4} ·{' '}
        <span style={{ color: account.status === 'active' ? C.text : C.red }}>
          {account.status === 'active' ? 'đang hoạt động' : 'key không dùng được'}
        </span>
        {account.lastError && <span style={{ color: C.red }}> · {account.lastError}</span>}
      </div>
      <form onSubmit={updateKey} className="flex flex-wrap items-center gap-2">
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API key mới"
          className={`${inputClass} w-full sm:w-80`} style={inputStyle} autoComplete="off" required />
        <Button type="submit" active disabled={busy} C={C}>{busy ? 'Đang kiểm tra...' : 'Đổi key'}</Button>
        <Button onClick={unregister} C={C}>Huỷ đăng ký</Button>
      </form>
      {message && <div style={{ color: message.ok ? C.text : C.red }}>{message.text}</div>}
    </div>
  );
}
