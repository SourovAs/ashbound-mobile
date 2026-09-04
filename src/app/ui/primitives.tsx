import { useMemo, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { uiSound } from './uiSound';

/* ------------------------------------------------------------ Button */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  locked?: boolean;
}
export function Button({ variant = 'default', size = 'md', selected, locked, className, children, onClick, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      aria-disabled={locked || rest.disabled}
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'ghost' && 'btn-ghost',
        size === 'sm' && 'px-3 py-1.5 text-[0.62rem]',
        size === 'md' && 'px-5 py-2.5 text-xs',
        size === 'lg' && 'px-8 py-3.5 text-sm',
        selected && 'is-selected',
        className,
      )}
      onClick={(e) => {
        if (locked || rest.disabled) return;
        uiSound.click();
        onClick?.(e);
      }}
      onPointerEnter={() => !locked && !rest.disabled && uiSound.hover()}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ Panel */
export function Panel({ className, children, flat }: { className?: string; children: ReactNode; flat?: boolean }) {
  return <div className={cn(flat ? 'panel-flat' : 'panel', className)}>{children}</div>;
}

/* ------------------------------------------------------------ Bars */
export function Bar({ value, max, kind, className }: { value: number; max: number; kind: 'health' | 'flame' | 'xp'; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={cn('bar', `bar-${kind}`, className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------ Icons (custom, consistent stroke) */
type IconName = 'coin' | 'essence' | 'attack' | 'jump' | 'dash' | 'special' | 'pause' | 'back' | 'lock' | 'star' | 'skull' | 'flame' | 'clock' | 'interact';
export function Icon({ name, className, size = 18 }: { name: IconName; className?: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className };
  switch (name) {
    case 'coin':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" fill="rgba(245,158,43,0.25)" />
          <circle cx="12" cy="12" r="4.5" />
        </svg>
      );
    case 'essence':
      return (
        <svg {...p}>
          <path d="M12 3l5 9-5 9-5-9z" fill="rgba(234,106,26,0.3)" />
          <path d="M12 8l2.5 4L12 16l-2.5-4z" />
        </svg>
      );
    case 'attack':
      return (
        <svg {...p}>
          <path d="M5 19l10-10" />
          <path d="M13 5l6 6" />
          <path d="M4 20l2-4 2 2z" fill="currentColor" />
          <path d="M15 7l2 2" />
        </svg>
      );
    case 'jump':
      return (
        <svg {...p}>
          <path d="M12 19V6" />
          <path d="M6 12l6-6 6 6" />
          <path d="M5 20h14" opacity="0.5" />
        </svg>
      );
    case 'dash':
      return (
        <svg {...p}>
          <path d="M4 12h11" />
          <path d="M11 7l5 5-5 5" />
          <path d="M3 7h4M3 17h4" opacity="0.5" />
        </svg>
      );
    case 'special':
    case 'flame':
      return (
        <svg {...p}>
          <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-6 1-9z" fill="rgba(245,158,43,0.35)" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...p}>
          <path d="M8 5v14M16 5v14" strokeWidth="2.4" />
        </svg>
      );
    case 'back':
      return (
        <svg {...p}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...p}>
          <rect x="6" y="11" width="12" height="9" rx="1" />
          <path d="M9 11V8a3 3 0 0 1 6 0v3" />
        </svg>
      );
    case 'star':
      return (
        <svg {...p}>
          <path d="M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.6l6.3-.8z" fill="currentColor" />
        </svg>
      );
    case 'skull':
      return (
        <svg {...p}>
          <path d="M5 11a7 7 0 0 1 14 0v4l-2 1v3H7v-3l-2-1z" />
          <circle cx="9.5" cy="11" r="1.4" fill="currentColor" />
          <circle cx="14.5" cy="11" r="1.4" fill="currentColor" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case 'interact':
      return (
        <svg {...p}>
          <path d="M12 4v10" />
          <path d="M8 10l4 4 4-4" />
          <path d="M5 20h14" />
        </svg>
      );
  }
}

/* ------------------------------------------------------------ Currency */
export function Currency({ coins, essence, compact }: { coins: number; essence: number; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', compact ? 'text-xs' : 'text-sm')}>
      <span className="flex items-center gap-1.5 text-flame-300">
        <Icon name="coin" size={compact ? 15 : 18} />
        <span className="t-stat">{coins}</span>
      </span>
      <span className="flex items-center gap-1.5 text-flame-500">
        <Icon name="essence" size={compact ? 15 : 18} />
        <span className="t-stat">{essence}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ Embers (ambient menu particles, CSS-driven) */
export function Embers({ count = 22 }: { count?: number }) {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i * 37 + 11) % 100}%`,
        dur: 9 + ((i * 7) % 9),
        delay: -((i * 13) % 12),
        dx: `${((i * 29) % 80) - 40}px`,
        size: 2 + (i % 3),
      })),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {items.map((e, i) => (
        <span
          key={i}
          className="ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            animationDuration: `${e.dur}s`,
            animationDelay: `${e.delay}s`,
            ['--dx' as string]: e.dx,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Screen frame for meta screens */
export function ScreenFrame({
  title,
  subtitle,
  onBack,
  right,
  children,
  bg,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
  children: ReactNode;
  bg?: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-ash-950 text-ash-100">
      {bg && <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />}
      <div className="absolute inset-0 bg-gradient-to-b from-ash-950/70 via-ash-950/80 to-ash-950" />
      <Embers count={14} />
      <div className="safe relative flex h-full flex-col">
        <header className="flex items-center gap-3 px-4 pt-3 pb-2 sm:px-6">
          <Button variant="ghost" size="sm" onClick={onBack} className="flex items-center gap-1 !px-2.5">
            <Icon name="back" size={16} />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="t-heading truncate text-sm text-ash-100 sm:text-base">{title}</h1>
            {subtitle && <p className="t-caption truncate">{subtitle}</p>}
          </div>
          {right}
        </header>
        <div className="scroll-y min-h-0 flex-1 px-4 pb-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
