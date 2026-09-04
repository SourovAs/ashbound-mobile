import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import type { Action } from '../../../game/input';
import { cn } from '../../../utils/cn';
import type { Settings } from '../../save';
import { Icon } from '../../ui/primitives';

interface Props {
  settings: Settings;
  dashCooldown: number; // 0..1
  specialReady: boolean;
  specialUnlocked: boolean;
  canInteract: boolean;
  setVirtual: (a: Action, active: boolean) => void;
  setAxis: (v: number) => void;
}

/**
 * Touch controls. The stick writes directly to the runtime and updates its own
 * DOM via refs — no React re-render per pointer move.
 */
export function VirtualControls({ settings, dashCooldown, specialReady, specialUnlocked, canInteract, setVirtual, setAxis }: Props) {
  const mirrored = settings.controlLayout === 'mirrored';
  const scale = settings.buttonSize;
  const opacity = settings.buttonOpacity;

  const dockStyle: CSSProperties = mirrored
    ? {
        position: 'absolute',
        left: 'max(14px, env(safe-area-inset-left))',
        bottom: 'max(14px, env(safe-area-inset-bottom))',
      }
    : {
        position: 'absolute',
        right: 'max(14px, env(safe-area-inset-right))',
        bottom: 'max(14px, env(safe-area-inset-bottom))',
      };

  const controlSurfaceStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity,
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" style={controlSurfaceStyle}>
      <div
        className="absolute top-0 bottom-0 w-1/2"
        style={mirrored ? { right: 0 } : { left: 0 }}
      >
        <Stick setAxis={setAxis} side={mirrored ? 'right' : 'left'} scale={scale} />
      </div>
      <div className="pointer-events-none" style={dockStyle}>
        <div className="relative" style={{ width: 220 * scale, height: 184 * scale }}>
          <ActionButton label="Jump" icon="jump" action="jump" setVirtual={setVirtual} size={76 * scale} style={{ right: 0, bottom: 0 }} />
          <ActionButton label="Attack" icon="attack" action="attack" setVirtual={setVirtual} size={72 * scale} style={{ right: 96 * scale, bottom: 10 * scale }} />
          <ActionButton label="Dash" icon="dash" action="dash" setVirtual={setVirtual} size={58 * scale} cooldown={dashCooldown} style={{ right: 18 * scale, bottom: 98 * scale }} />
          <ActionButton
            label={canInteract ? 'Ignite' : 'Special'}
            icon={canInteract ? 'interact' : 'special'}
            action={canInteract ? 'interact' : 'special'}
            setVirtual={setVirtual}
            size={54 * scale}
            ready={canInteract || specialReady}
            disabled={!canInteract && !specialUnlocked}
            style={{ right: 118 * scale, bottom: 108 * scale }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  action,
  setVirtual,
  size,
  style,
  cooldown = 1,
  ready,
  disabled,
}: {
  label: string;
  icon: 'jump' | 'attack' | 'dash' | 'special' | 'interact';
  action: Action;
  setVirtual: (a: Action, active: boolean) => void;
  size: number;
  style: React.CSSProperties;
  cooldown?: number;
  ready?: boolean;
  disabled?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const activeAction = useRef<Action | null>(null);

  const down = (e: RPointerEvent) => {
    e.preventDefault();
    if (disabled) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    activeAction.current = action;
    setVirtual(action, true);
    setPressed(true);
    if (navigator.vibrate) navigator.vibrate(8);
  };
  const up = () => {
    if (activeAction.current) setVirtual(activeAction.current, false);
    activeAction.current = null;
    setPressed(false);
  };
  useEffect(() => () => up(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const cdDeg = Math.round((1 - cooldown) * 360);
  return (
    <button
      className={cn('vbtn pointer-events-auto absolute', pressed && 'is-pressed', ready && !pressed && 'is-ready', disabled && 'is-disabled')}
      style={{ width: size, height: size, ...style }}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={(e) => e.pointerType !== 'touch' && up()}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      {cooldown < 1 && <span className="cd" style={{ background: `conic-gradient(rgba(7,8,11,0.7) ${cdDeg}deg, transparent ${cdDeg}deg)` }} />}
      <Icon name={icon} size={size * 0.42} className={ready ? 'text-flame-300' : 'text-ash-100'} />
      <span className="lbl">{label}</span>
    </button>
  );
}

function Stick({ setAxis, side, scale }: { setAxis: (v: number) => void; side: 'left' | 'right'; scale: number }) {
  const zone = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const RADIUS = 44 * scale;

  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    const show = (x: number, y: number) => {
      if (!base.current || !knob.current) return;
      const r = el.getBoundingClientRect();
      base.current.style.opacity = '1';
      base.current.style.transform = `translate(${x - r.left - RADIUS * 1.25}px, ${y - r.top - RADIUS * 1.25}px)`;
      knob.current.style.transform = 'translate(0px,0px)';
    };
    const onDown = (e: PointerEvent) => {
      if (origin.current) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      show(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      const o = origin.current;
      if (!o || e.pointerId !== o.id) return;
      let dx = e.clientX - o.x;
      const dy = e.clientY - o.y;
      const dist = Math.hypot(dx, dy);
      // drag the origin along if the finger travels far (floating stick)
      if (dist > RADIUS * 1.4) {
        o.x = e.clientX - (dx / dist) * RADIUS * 1.4;
        o.y = e.clientY - (dy / dist) * RADIUS * 1.4;
        dx = e.clientX - o.x;
        show(o.x, o.y);
      }
      const ax = Math.max(-1, Math.min(1, dx / (RADIUS * 0.75)));
      setAxis(ax);
      if (knob.current) knob.current.style.transform = `translate(${Math.max(-RADIUS, Math.min(RADIUS, dx))}px, ${Math.max(-RADIUS, Math.min(RADIUS, dy)) * 0.4}px)`;
    };
    const onUp = (e: PointerEvent) => {
      if (!origin.current || e.pointerId !== origin.current.id) return;
      origin.current = null;
      setAxis(0);
      if (base.current) base.current.style.opacity = '0';
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setAxis(0);
    };
  }, [RADIUS, setAxis]);

  return (
    <div ref={zone} className="pointer-events-auto absolute inset-0" style={{ touchAction: 'none' }}>
      {/* resting hint */}
      <div
        className={cn('pointer-events-none absolute bottom-[calc(2.4rem+env(safe-area-inset-bottom))] flex items-center gap-3 text-ash-300/60', side === 'left' ? 'left-[calc(2rem+env(safe-area-inset-left))]' : 'right-[calc(2rem+env(safe-area-inset-right))]')}
      >
        <span className="t-sub text-[0.55rem]">◀ &nbsp; move &nbsp; ▶</span>
      </div>
      <div ref={base} className="pointer-events-none absolute top-0 left-0 rounded-full border border-ash-300/40 bg-ash-900/40 opacity-0 transition-opacity" style={{ width: RADIUS * 2.5, height: RADIUS * 2.5 }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div ref={knob} className="rounded-full border-2 border-flame-300/70 bg-gradient-to-b from-flame-500/70 to-flame-700/70 shadow-[0_0_18px_rgba(245,158,43,0.4)]" style={{ width: RADIUS * 1.1, height: RADIUS * 1.1 }} />
        </div>
      </div>
    </div>
  );
}
