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
          <span className="text-slate-400">Farm:</span>
          {farms.map(id => (
            <button key={id} type="button" onClick={() => setFarmId(id)}
              className={`rounded-lg border px-3 py-1 font-mono text-xs ${id === farmId ? 'border-blue-500 bg-blue-500/15 text-blue-200' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}>
              {id}
            </button>
          ))}
        </div>
      )}
      <FlipPanel key={farmId} farmId={farmId} onLock={onLock} refreshKey={refreshKey} />
    </div>
  );
}
