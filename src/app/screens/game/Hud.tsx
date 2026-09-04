import type { CSSProperties } from 'react';
import type { HudSnapshot } from '../../../game/types';
import { cn } from '../../../utils/cn';
import type { Settings } from '../../save';
import { Bar, Icon } from '../../ui/primitives';

export function Hud({ hud, settings, onPause, levelLabel }: { hud: HudSnapshot; settings: Settings; onPause: () => void; levelLabel: string }) {
  const contrast = settings.highContrast;
  const big = settings.textSize === 'large';
  const topInset = 'max(10px, env(safe-area-inset-top))';
  const leftInset = 'max(12px, env(safe-area-inset-left))';
  const rightInset = 'max(12px, env(safe-area-inset-right))';

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Top-left: portrait + bars. Explicit inline anchors are used here and
          for the controls below because Android WebView can drop arbitrary
          Tailwind inset classes when loading inline HTML. */}
      <div
        className={cn('absolute flex items-center gap-2.5 p-1.5 pr-3', contrast ? 'bg-ash-950/85 border border-ash-500/50' : 'bg-ash-950/40 backdrop-blur-[2px]')}
        style={{ top: topInset, left: leftInset } as CSSProperties}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-flame-500/50 sm:h-14 sm:w-14">
          <img src="/images/ui_portrait_flamebearer.jpg" alt="" className="h-full w-full object-cover object-top" />
          <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.7)]" />
        </div>
        <div className={cn('w-36 sm:w-44', big && 'w-44 sm:w-52')}>
          <div className="flex items-end justify-between">
            <span className="t-sub text-[0.5rem] text-ash-300">Health</span>
            <span className={cn('t-stat text-[0.68rem] text-ash-100', big && 'text-[0.8rem]')}>
              {hud.hp} / {hud.maxHp}
            </span>
          </div>
          <Bar value={hud.hp} max={hud.maxHp} kind="health" className="mb-1.5 h-[9px]" />
          <div className="flex items-end justify-between">
            <span className="t-sub text-[0.5rem] text-flame-300">Ash Flame</span>
            <span className={cn('t-stat text-[0.68rem] text-flame-200', big && 'text-[0.8rem]')}>
              {hud.flame} / {hud.maxFlame}
            </span>
          </div>
          <Bar value={hud.flame} max={hud.maxFlame} kind="flame" className="h-[7px]" />
        </div>
      </div>

      {/* Top-center: objective. Keep it in a bounded center lane so it cannot
          collide with the portrait on the left or pause/currency on the right. */}
      <div
        className="absolute left-1/2 max-w-[34vw] -translate-x-1/2 text-center"
        style={{ top: topInset } as CSSProperties}
      >
        <p className="t-sub truncate text-[0.5rem] text-ash-400">{levelLabel}</p>
        <p className={cn('t-heading truncate text-[0.7rem] text-ash-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]', big && 'text-[0.85rem]')}>{hud.objective}</p>
      </div>

      {/* Top-right: currency + pause. This stays entirely in the top band;
          action buttons are explicitly docked in the bottom-right band. */}
      <div
        className="absolute flex items-center gap-2"
        style={{ top: topInset, right: rightInset } as CSSProperties}
      >
        <div className={cn('flex items-center gap-3 px-2.5 py-1.5', contrast ? 'bg-ash-950/85 border border-ash-500/50' : 'bg-ash-950/40 backdrop-blur-[2px]')}>
          <span className="flex items-center gap-1 text-flame-300">
            <Icon name="coin" size={15} />
            <span className={cn('t-stat text-xs', big && 'text-sm')}>{hud.coins}</span>
          </span>
          <span className="flex items-center gap-1 text-flame-500">
            <Icon name="essence" size={15} />
            <span className={cn('t-stat text-xs', big && 'text-sm')}>{hud.essence}</span>
          </span>
        </div>
        <button onClick={onPause} className="btn btn-ghost pointer-events-auto flex h-9 w-9 items-center justify-center !p-0" aria-label="Pause">
          <Icon name="pause" size={16} />
        </button>
      </div>
    </div>
  );
}
