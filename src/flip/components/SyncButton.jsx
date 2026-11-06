import { useState } from 'react';
import { api } from '../api/client';
import { useCooldown } from '../hooks/useCooldown';

const COOLDOWN_MS = 15 * 1000;

/**
 * Nút Đồng bộ: server gọi API SFL (giao dịch của farm + ảnh chụp chợ) rồi ghi DB.
 * Xong thì khoá 15 giây mới bấm tiếp được (server cũng chặn, trả 429 kèm số ms còn lại).
 */
export default function SyncButton({ flipKey, onSynced }) {
  const { remaining, active, start } = useCooldown();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const sync = async () => {
    if (busy || active) return;
    setBusy(true);
    setMessage(null);
    try {
      const data = await api.sync(flipKey);
      const failed = (data.results || []).filter(r => r.error);
      // 429 = API game giới hạn, không phải lỗi dữ liệu: báo màu vàng, không đỏ
      const limited = failed.length && failed.every(r => r.rateLimited || /429/.test(r.error));
      setMessage(failed.length
        ? { ok: false, warn: limited, text: limited ? failed[0].error : `Lỗi farm ${failed.map(r => r.farmId).join(', ')}: ${failed[0].error}` }
        : { ok: true, text: 'Đã đồng bộ' });
      start(data.cooldownMs || COOLDOWN_MS);
      onSynced?.();
    } catch (e) {
      if (e.code === 'COOLDOWN') start(e.data?.retryAfterMs || COOLDOWN_MS);
      else {
        setMessage({ ok: false, text: e.message });
        start(COOLDOWN_MS);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className={`hidden md:inline text-xs ${message.ok ? 'text-buy' : message.warn ? 'text-sun-300' : 'text-loss'}`} title={message.text}>
          {message.text.length > 60 ? `${message.text.slice(0, 60)}…` : message.text}
        </span>
      )}
      {active && !busy ? (
        // Đang khoá 15 giây: ẩn nút, chỉ hiện đếm ngược nên không bấm được
        <span className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-xl bg-ink-800 px-3.5 py-2 text-sm text-fg-dim select-none"
          title="Đợi hết đếm ngược để đồng bộ tiếp">
          <span className="tabular-nums font-semibold text-fg">{remaining}s</span>
          <span>nữa đồng bộ được</span>
        </span>
      ) : (
        <button type="button" onClick={sync} disabled={busy}
          title="Lấy giao dịch mới nhất của farm và giá chợ từ API vào hệ thống"
          className={`inline-flex min-w-[148px] items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${busy ? 'cursor-wait bg-ink-800 text-fg-dim' : 'bg-sun-400 text-ink-950 hover:bg-sun-300'}`}>
          <span className={busy ? 'animate-spin' : ''}>⟳</span>
          <span>{busy ? 'Đang đồng bộ...' : 'Đồng bộ'}</span>
        </button>
      )}
    </div>
  );
}
