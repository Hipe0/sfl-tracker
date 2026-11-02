import { Component, useState } from 'react';
import { getAssetUrl } from '../../utils/gameConstants';
import { DECISION_META, SEASON_META } from '../lib/format';

/** Ảnh tài nguyên; không tìm thấy ảnh thì hiện chữ cái đầu thay vì ô vỡ */
export function ItemIcon({ item, size = 28 }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (broken || !item) {
    return (
      <span className="inline-flex items-center justify-center rounded-md bg-slate-700/60 text-slate-300 text-xs font-bold shrink-0" style={style}>
        {(item || '?').slice(0, 1)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-md bg-slate-800/80 border border-slate-700/60 shrink-0" style={style}>
      <img src={getAssetUrl(item)} alt="" className="max-w-[80%] max-h-[80%] [image-rendering:pixelated]" onError={() => setBroken(true)} />
    </span>
  );
}

/** Khối trống có giải thích, dùng mọi nơi thay cho trang trắng */
export function EmptyState({ icon = '🌾', title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6 text-slate-400">
      <div className="text-3xl opacity-80">{icon}</div>
      {title && <div className="text-slate-200 font-semibold">{title}</div>}
      {children && <div className="text-sm max-w-md leading-relaxed">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">
      <span>{error.message || String(error)}</span>
      {onRetry && <button type="button" onClick={onRetry} className="underline underline-offset-2 hover:text-white">Thử lại</button>}
    </div>
  );
}

export function Card({ title, subtitle, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-700/60 bg-[#111827]/80 shadow-lg ${className}`}>
      {(title || right) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-700/50">
          <div>
            {title && <h2 className="text-[13px] font-bold uppercase tracking-wider text-slate-200">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** Nhóm nút chọn 1 (1D/3D/7D...) */
export function Segmented({ options, value, onChange, size = 'md' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm';
  return (
    <div className="inline-flex flex-wrap rounded-lg border border-slate-700/70 bg-slate-900/70 p-0.5">
      {options.map(o => {
        const id = typeof o === 'string' ? o : o.id;
        const label = typeof o === 'string' ? o : o.label;
        const active = value === id;
        return (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`${pad} rounded-md font-semibold transition-colors ${active ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-100'}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** Nút lọc dạng chip, có số đếm */
export function Chip({ active, onClick, children, count, tag }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'border-blue-500/70 bg-blue-500/15 text-blue-200' : 'border-slate-700/70 bg-slate-900/50 text-slate-300 hover:border-slate-500'}`}>
      {children}
      {tag && <span className="rounded bg-amber-400 px-1 text-[9px] font-black text-slate-900">{tag}</span>}
      {count != null && <span className="text-slate-500">{count}</span>}
    </button>
  );
}

export function DecisionBadge({ decision }) {
  const meta = DECISION_META[decision] || DECISION_META.none;
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>;
}

export function SeasonTags({ seasons = [] }) {
  if (!seasons.length) return null;
  return (
    <span className="inline-flex gap-0.5" title={seasons.map(s => SEASON_META[s]?.label).join(', ')}>
      {seasons.map(s => <span key={s} className="text-[11px]">{SEASON_META[s]?.icon}</span>)}
    </span>
  );
}

export function Delta({ value, digits = 1 }) {
  if (value == null || !Number.isFinite(value)) return <span className="text-slate-500">–</span>;
  const cls = value > 0 ? 'text-emerald-300 bg-emerald-500/10' : value < 0 ? 'text-rose-300 bg-rose-500/10' : 'text-slate-300 bg-slate-500/10';
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${cls}`}>{value > 0 ? '+' : ''}{(value * 100).toFixed(digits)}%</span>;
}

/** Lỗi trong 1 trang không làm trắng cả app */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[FLIP] Lỗi giao diện:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <EmptyState icon="⚠️" title="Phần này gặp lỗi khi hiển thị"
          action={<button type="button" className="mt-2 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800" onClick={() => this.setState({ error: null })}>Tải lại phần này</button>}>
          {String(this.state.error?.message || this.state.error)}
        </EmptyState>
      );
    }
    return this.props.children;
  }
}
