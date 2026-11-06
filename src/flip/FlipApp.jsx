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
  { id: 'market', label: 'Thị trường', ownerOnly: true },
  { id: 'ledger', label: 'Sổ Flip' },
  { id: 'demand', label: 'Mùa & Nhu cầu', ownerOnly: true }
];
const tabsFor = role => TABS.filter(t => !t.ownerOnly || role === 'owner');

// Tab lưu trên URL (#market...). Hash lạ hoặc tab không có quyền thì về tab đầu được phép, không bao giờ ra trang trắng
const tabFromHash = () => (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');

export default function FlipApp() {
  const auth = useFlipAuth();
  const [tab, setTab] = useState(tabFromHash);
  const [refreshKey, setRefreshKey] = useState(0);
  // Các tab đã mở ít nhất 1 lần (giữ trong RAM của trình duyệt)
  const [visited, setVisited] = useState(() => new Set());

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
    return <div className="flip-root min-h-screen bg-ink-950 flex items-center justify-center text-fg-muted animate-pulse">Đang kiểm tra mã truy cập...</div>;
  }
  if (auth.status !== 'ready') {
    return <AuthPage onUnlock={auth.unlock} error={auth.error} checking={auth.status === 'checking'} />;
  }

  const { access } = auth;
  const allowedTabs = tabsFor(access.role);
  const current = allowedTabs.some(t => t.id === tab) ? tab : allowedTabs[0].id;
  if (!visited.has(current)) setVisited(v => new Set(v).add(current));
  const who = access.role === 'owner' ? `Chủ app · ${access.farms.length} farm` : `Farm ${access.farms[0]}`;

  return (
    <div className="flip-root min-h-screen bg-ink-950 text-fg">
      <header className="sticky top-0 z-40 border-b border-line-soft bg-ink-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-6 gap-y-2 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-sun-400/15 text-lg ring-1 ring-sun-400/30">🌻</span>
            <span className="text-[17px] font-bold tracking-tight text-fg">SFL <span className="text-sun-400">Flip</span></span>
          </div>
          <nav className="order-3 -mb-px flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {allowedTabs.map(t => (
              <button key={t.id} type="button" onClick={() => go(t.id)}
                className={`whitespace-nowrap border-b-2 px-3 py-4 text-sm font-medium transition-colors ${current === t.id ? 'border-sun-400 text-fg' : 'border-transparent text-fg-dim hover:text-fg'}`}>
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5 py-2">
            <span className="hidden text-xs text-fg-dim lg:inline">{who}</span>
            <SyncButton flipKey={auth.key} onSynced={() => setRefreshKey(k => k + 1)} />
            <button type="button" onClick={auth.lock} title="Quên mã trên trình duyệt này"
              className="rounded-xl px-3 py-2 text-sm text-fg-dim hover:bg-ink-800 hover:text-fg">Đăng xuất</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6">
        {/* Tab đã mở thì giữ lại (chỉ ẩn đi), nhảy qua lại không tải lại dữ liệu. Muốn số mới thì bấm Đồng bộ */}
        {visited.has('market') && (
          <div hidden={current !== 'market'}>
            <ErrorBoundary><MarketPage flipKey={auth.key} refreshKey={refreshKey} /></ErrorBoundary>
          </div>
        )}
        {visited.has('ledger') && (
          <div hidden={current !== 'ledger'}>
            <ErrorBoundary>
              <Suspense fallback={<EmptyState icon="⏳" title="Đang tải Sổ Flip..." />}>
                <LedgerPage access={access} onLock={auth.lock} refreshKey={refreshKey} />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
        {visited.has('demand') && (
          <div hidden={current !== 'demand'}>
            <ErrorBoundary><DemandPage flipKey={auth.key} isOwner={access.role === 'owner'} refreshKey={refreshKey} /></ErrorBoundary>
          </div>
        )}
      </main>
    </div>
  );
}
