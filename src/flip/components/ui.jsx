import { Component, useState } from 'react';
import { getAssetUrl } from '../../utils/gameConstants';
import { DECISION_META, SEASON_META } from '../lib/format';

/** Ảnh tài nguyên; không tìm thấy ảnh thì hiện chữ cái đầu thay vì ô vỡ */
export function ItemIcon({ item, size = 28 }) {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size };
  if (broken || !item) {
    return (
      <span className="inline-flex items-center justify-center rounded-lg bg-ink-800 text-fg-muted text-xs font-bold shrink-0" style={style}>
        {(item || '?').slice(0, 1)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-ink-800 ring-1 ring-line shrink-0" style={style}>
      <img src={getAssetUrl(item)} alt="" className="max-w-[80%] max-h-[80%] [image-rendering:pixelated]" onError={() => setBroken(true)} />
    </span>
  );
}

/** Khối trống có giải thích, dùng mọi nơi thay cho trang trắng */
export function EmptyState({ icon = '🌾', title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-10 px-6 text-fg-muted">
      <div className="text-3xl opacity-80">{icon}</div>
      {title && <div className="text-fg font-semibold">{title}</div>}
      {children && <div className="text-sm max-w-md leading-relaxed">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="m-3 flex flex-wrap items-center gap-3 rounded-xl border border-loss/30 bg-loss/10 px-4 py-2 text-sm text-loss">
      <span>{error.message || String(error)}</span>
      {onRetry && <button type="button" onClick={onRetry} className="underline underline-offset-2 hover:text-white">Thử lại</button>}
    </div>
  );
}

export function Card({ title, subtitle, right, children, className = '', icon }) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-line bg-ink-900 ${className}`}>
      {(title || right) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3.5 border-b border-line-soft">
          <div className="min-w-0">
            {title && <h2 className="flex items-center gap-2 text-[15px] font-semibold text-fg">{icon && <span className="text-base">{icon}</span>}{title}</h2>}
            {subtitle && <p className="text-xs text-fg-dim mt-1">{subtitle}</p>}
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
    <div className="inline-flex flex-wrap rounded-xl bg-ink-800 p-1">
      {options.map(o => {
        const id = typeof o === 'string' ? o : o.id;
        const label = typeof o === 'string' ? o : o.label;
        const active = value === id;
        return (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`${pad} rounded-lg font-semibold transition-colors ${active ? 'bg-ink-700 text-sun-300 shadow-sm' : 'text-fg-dim hover:text-fg'}`}>
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? 'border-sun-400/60 bg-sun-400/10 text-sun-300' : 'border-line bg-ink-850 text-fg-muted hover:border-ink-700 hover:text-fg'}`}>
      {children}
      {tag && <span className="rounded-full bg-sun-400 px-1.5 text-[9px] font-black text-ink-950">{tag}</span>}
      {count != null && <span className={`num ${active ? 'text-sun-400/70' : 'text-fg-dim'}`}>{count}</span>}
    </button>
  );
}

export function DecisionBadge({ decision }) {
  const meta = DECISION_META[decision] || DECISION_META.none;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />{meta.label}
    </span>
  );
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
  if (value == null || !Number.isFinite(value)) return <span className="text-fg-dim">–</span>;
  const cls = value > 0 ? 'text-buy bg-buy/10' : value < 0 ? 'text-loss bg-loss/10' : 'text-fg-muted bg-ink-800';
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>{value > 0 ? '+' : ''}{(value * 100).toFixed(digits)}%</span>;
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
          action={<button type="button" className="mt-2 rounded-lg border border-line px-3 py-1.5 text-sm text-fg hover:bg-ink-800" onClick={() => this.setState({ error: null })}>Tải lại phần này</button>}>
          {String(this.state.error?.message || this.state.error)}
        </EmptyState>
      );
    }
    return this.props.children;
  }
}

/** Ô số liệu lớn: nhãn nhỏ ở trên, số to ở dưới */
export function Stat({ label, value, hint, tone = 'fg', className = '' }) {
  const color = { fg: 'text-fg', buy: 'text-buy', loss: 'text-loss', sell: 'text-sell', sun: 'text-sun-300', muted: 'text-fg-muted' }[tone] || 'text-fg';
  return (
    <div className={className}>
      <div className="text-[11px] font-medium text-fg-dim">{label}</div>
      <div className={`num mt-0.5 text-lg font-semibold leading-tight ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-fg-dim">{hint}</div>}
    </div>
  );
}

/** Khối giải thích gập lại được, để chữ dài không chiếm chỗ */
export function Explain({ title = 'Cách đọc', children }) {
  return (
    <details className="group border-t border-line-soft px-5 py-3 text-xs text-fg-dim">
      <summary className="cursor-pointer select-none list-none font-medium text-fg-muted hover:text-fg">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">›</span>{title}
      </summary>
      <div className="mt-2 space-y-1.5 leading-relaxed">{children}</div>
    </details>
  );
}
