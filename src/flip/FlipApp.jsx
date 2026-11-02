import { Suspense, lazy, useEffect, useState } from 'react';
import { useFlipAuth } from './hooks/useFlipAuth';
import AuthPage from './pages/AuthPage';
import MarketPage from './pages/MarketPage';
import DemandPage from './pages/DemandPage';
import SyncButton from './components/SyncButton';
import { ErrorBoundary, EmptyState } from './components/ui';

// Sổ Flip dùng recharts (nặng): chỉ tải khi mở tab
const LedgerPage = lazy(() => import('./pages/LedgerPage'));

// ownerOnly: chỉ chủ app (mã FLIP_OWNER_KEY) thấy; người dùng thường chỉ có Sổ Flip
const TABS = [
  { id: 'market', label: 'Thị trường & Điểm mua', icon: '📈', ownerOnly: true },
  { id: 'ledger', label: 'Sổ Flip (lãi/lỗ)', icon: '🧾' },
  { id: 'demand', label: 'Mùa & Nhu cầu', icon: '🗓️', ownerOnly: true }
];
const tabsFor = role => TABS.filter(t => !t.ownerOnly || role === 'owner');

// Tab lưu trên URL (#market...). Hash lạ hoặc tab không có quyền thì về tab đầu được phép, không bao giờ ra trang trắng
const tabFromHash = () => (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');

export default function FlipApp() {
  const auth = useFlipAuth();
  const [tab, setTab] = useState(tabFromHash);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = id => {
    setTab(id);
    if (window.location.hash !== `#${id}`) window.history.replaceState(null, '', `#${id}`);
  };

  if (auth.status === 'checking' && !auth.access) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 animate-pulse">Đang kiểm tra mã truy cập...</div>;
  }
  if (auth.status !== 'ready') {
    return <AuthPage onUnlock={auth.unlock} error={auth.error} checking={auth.status === 'checking'} />;
  }

  const { access } = auth;
  const allowedTabs = tabsFor(access.role);
  const current = allowedTabs.some(t => t.id === tab) ? tab : allowedTabs[0].id;
  const who = access.role === 'owner' ? `Chủ app · ${access.farms.length} farm` : `Farm ${access.farms[0]}`;

  return (
    <div className="min-h-screen bg-[#0b1220]/60">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0b1220]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📈</span>
            <span className="text-lg font-extrabold text-white">SFL <span className="text-blue-400">Flip</span></span>
          </div>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto md:ml-6">
            {allowedTabs.map(t => (
              <button key={t.id} type="button" onClick={() => go(t.id)}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${current === t.id ? 'bg-slate-800 text-white shadow-inner' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'}`}>
                <span className="mr-1.5">{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">{who}</span>
            <SyncButton flipKey={auth.key} onSynced={() => setRefreshKey(k => k + 1)} />
            <button type="button" onClick={auth.lock} title="Quên mã trên trình duyệt này"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        <ErrorBoundary key={current}>
          {current === 'market' && <MarketPage flipKey={auth.key} refreshKey={refreshKey} />}
          {current === 'ledger' && (
            <Suspense fallback={<EmptyState icon="⏳" title="Đang tải Sổ Flip..." />}>
              <LedgerPage access={access} onLock={auth.lock} refreshKey={refreshKey} />
            </Suspense>
          )}
          {current === 'demand' && <DemandPage flipKey={auth.key} isOwner={access.role === 'owner'} refreshKey={refreshKey} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
