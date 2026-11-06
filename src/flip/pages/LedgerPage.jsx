import { useEffect, useState } from 'react';
import FlipPanel from '../../components/FlipPanel';
import { EmptyState } from '../components/ui';

/** Sổ Flip: bảng lãi/lỗ FIFO cũ (FlipPanel). Mã chủ có nhiều farm thì chọn farm. */
export default function LedgerPage({ access, onLock, refreshKey }) {
  const farmsKey = (access?.farms || []).join(',');
  const farms = farmsKey ? farmsKey.split(',') : [];
  const [farmId, setFarmId] = useState(farms[0] || null);
  useEffect(() => {
    const list = farmsKey ? farmsKey.split(',') : [];
    setFarmId(current => (list.includes(current) ? current : list[0] || null));
  }, [farmsKey]);

  if (!farmId) {
    return (
      <EmptyState icon="🧾" title="Chưa có farm nào gắn với mã này">
        Mã chủ cần FLIP_FARM_IDS trong .env. Người dùng thường thì đăng ký lại bằng Farm ID + API key.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      {farms.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-dim">Farm:</span>
          {farms.map(id => (
            <button key={id} type="button" onClick={() => setFarmId(id)}
              className={`num rounded-full border px-3 py-1 text-xs ${id === farmId ? 'border-sun-400/50 bg-sun-400/10 text-sun-300' : 'border-line bg-ink-900 text-fg-muted hover:text-fg'}`}>
              {id}
            </button>
          ))}
        </div>
      )}
      <FlipPanel key={farmId} farmId={farmId} onLock={onLock} refreshKey={refreshKey} />
    </div>
  );
}
