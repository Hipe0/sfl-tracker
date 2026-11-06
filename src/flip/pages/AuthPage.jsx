import { useEffect, useState } from 'react';
import { api } from '../api/client';

const ERRORS = {
  INVALID: 'Kiểm tra lại Farm ID và API key',
  INVALID_KEY: 'API key không đúng hoặc đã bị thu hồi',
  FARM_TAKEN: 'Farm này đã đăng ký bằng API key khác. Nhập đúng key cũ để lấy lại mã',
  OWNER_FARM: 'Farm này do chủ app quản lý, dùng mã chủ để vào',
  REGISTRATION_DISABLED: 'Chủ app chưa bật đăng ký (cần FLIP_KEY_SECRET trong .env)',
  TOO_MANY_ATTEMPTS: 'Thử quá nhiều lần, đợi một lúc rồi thử lại',
  FULL: 'App đã đủ người dùng',
  SFL_UNAVAILABLE: 'Không gọi được API Sunflower Land, thử lại sau'
};
const errorText = e => ERRORS[e?.code] || e?.message || 'Có lỗi xảy ra';

const input = 'w-full rounded-xl border border-line bg-ink-950 px-3 py-2.5 text-sm text-fg outline-none focus:border-sun-400/60';

/**
 * Cửa vào app: bắt buộc đăng ký bằng Farm ID + API key Sunflower Land của chính người dùng,
 * hoặc nhập mã truy cập đã có.
 */
export default function AuthPage({ onUnlock, error: authError, checking }) {
  const [info, setInfo] = useState(undefined); // undefined = đang hỏi, null = server tắt FLIP
  const [mode, setMode] = useState('register');
  const [farmId, setFarmId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [issued, setIssued] = useState(null);

  useEffect(() => {
    api.publicInfo().then(setInfo).catch(e => setInfo(e.code === 'NETWORK' ? { offline: true } : null));
  }, []);

  useEffect(() => { if (info && !info.registration && !info.offline) setMode('code'); }, [info]);

  const register = async (e, keyOverride) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await api.register(farmId.trim(), (keyOverride ?? apiKey).trim());
      setApiKey('');
      setIssued(data.code);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = e => {
    e.preventDefault();
    const value = code.trim();
    // Dán nhầm API key (sfl.xxx) vào ô mã: chuyển sang đăng ký
    if (value.startsWith('sfl.')) {
      setApiKey(value);
      setCode('');
      setMode('register');
      setError('Đây là API key, không phải mã truy cập. Nhập Farm ID rồi bấm Đăng ký.');
      return;
    }
    onUnlock(value);
  };

  return (
    <div className="flip-root min-h-screen flex items-center justify-center bg-ink-950 p-4 text-fg">
      <div className="w-full max-w-md rounded-2xl border border-line bg-ink-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sun-400/15 text-2xl ring-1 ring-sun-400/30">🌻</span>
          <div>
            <h1 className="text-xl font-bold text-fg">SFL <span className="text-sun-400">Flip</span></h1>
            <p className="text-xs text-fg-muted">Giá, điểm mua và lãi/lỗ lướt sóng tài nguyên Sunflower Land</p>
          </div>
        </div>

        {info === undefined && <div className="text-sm text-fg-muted animate-pulse">Đang kết nối server...</div>}
        {info === null && (
          <div className="rounded-lg border border-sun-400/40 bg-sun-400/10 p-3 text-sm text-sun-300">
            Server chưa bật FLIP. Đặt <code>FLIP_ENABLED=true</code> trong file <code>.env</code> rồi khởi động lại backend.
          </div>
        )}
        {info?.offline && (
          <div className="rounded-lg border border-loss/40 bg-loss/10 p-3 text-sm text-loss">
            Không kết nối được backend. Chạy <code>npm run dev</code> (hoặc start_project.bat) rồi tải lại trang.
          </div>
        )}

        {info && !info.offline && !issued && (
          <>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-ink-850 p-1">
              {[['register', 'Đăng ký bằng API key'], ['code', 'Đã có mã truy cập']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => { setMode(id); setError(null); }}
                  disabled={id === 'register' && !info.registration}
                  className={`rounded-md py-2 text-xs font-semibold disabled:opacity-40 ${mode === id ? 'bg-sun-400 text-ink-950' : 'text-fg-muted hover:text-fg'}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === 'register' ? (
              <form onSubmit={register} className="space-y-3">
                <label className="block text-xs text-fg-muted space-y-1">
                  <span>Farm ID</span>
                  <input className={input} value={farmId} onChange={e => setFarmId(e.target.value)} inputMode="numeric" required />
                </label>
                <label className="block text-xs text-fg-muted space-y-1">
                  <span>API key Sunflower Land (sfl.xxx)</span>
                  <input className={input} type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} autoComplete="off" required />
                </label>
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-sun-400 text-ink-950 py-2.5 text-sm font-bold text-fg hover:bg-sun-300 disabled:opacity-60">
                  {busy ? 'Đang kiểm tra key...' : 'Đăng ký'}
                </button>
                <p className="text-[11px] leading-relaxed text-fg-dim">
                  Bắt buộc dùng API key của chính bạn (lấy trong game, cần VIP + Bumpkin level 50). Key chỉ dùng để đọc giao dịch
                  và kho đồ của farm này, được mã hoá trên server. Đổi key trong game thì vào mục Tài khoản để cập nhật.
                </p>
              </form>
            ) : (
              <form onSubmit={submitCode} className="space-y-3">
                <label className="block text-xs text-fg-muted space-y-1">
                  <span>Mã truy cập (flp_...)</span>
                  <input className={input} type="password" value={code} onChange={e => setCode(e.target.value)} autoComplete="off" required />
                </label>
                <button type="submit" disabled={checking} className="w-full rounded-lg bg-sun-400 text-ink-950 py-2.5 text-sm font-bold text-fg hover:bg-sun-300 disabled:opacity-60">
                  {checking ? 'Đang kiểm tra...' : 'Vào app'}
                </button>
              </form>
            )}
          </>
        )}

        {issued && (
          <div className="space-y-3 rounded-lg border border-buy/40 bg-buy/10 p-4">
            <div className="text-sm text-buy">Đăng ký xong. Lưu mã truy cập này để vào app trên máy khác:</div>
            <code className="block break-all rounded bg-ink-950 px-3 py-2 text-xs text-fg">{issued}</code>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigator.clipboard?.writeText(issued)} className="flex-1 rounded-lg border border-line py-2 text-sm text-fg hover:bg-ink-800">Copy mã</button>
              <button type="button" onClick={() => onUnlock(issued)} className="flex-1 rounded-lg bg-sun-400 text-ink-950 py-2 text-sm font-bold text-fg hover:bg-sun-300">Vào app</button>
            </div>
          </div>
        )}

        {(error || authError) && <div className="text-sm text-loss">{error || authError}</div>}
      </div>
    </div>
  );
}
