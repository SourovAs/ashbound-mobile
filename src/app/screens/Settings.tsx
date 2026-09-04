import { useState } from 'react';
import { cn } from '../../utils/cn';
import { SAVE_VERSION, type Settings as SettingsT } from '../save';
import { actions, useAppState } from '../store';
import { Button, Panel, ScreenFrame } from '../ui/primitives';
import { uiSound } from '../ui/uiSound';

type Tab = 'audio' | 'gameplay' | 'controls' | 'accessibility' | 'system';
const TABS: { id: Tab; label: string }[] = [
  { id: 'audio', label: 'Audio' },
  { id: 'gameplay', label: 'Gameplay' },
  { id: 'controls', label: 'Controls' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'system', label: 'System' },
];

export function SettingsScreen({ embedded, onClose }: { embedded?: boolean; onClose?: () => void }) {
  const { save } = useAppState();
  const s = save.settings;
  const [tab, setTab] = useState<Tab>('audio');
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (patch: Partial<SettingsT>) => {
    actions.updateSettings(patch);
    if (patch.musicVolume !== undefined || patch.sfxVolume !== undefined) {
      uiSound.setVolumes(patch.musicVolume ?? s.musicVolume, patch.sfxVolume ?? s.sfxVolume);
    }
  };

  const body = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Button key={t.id} size="sm" selected={tab === t.id} variant={tab === t.id ? 'default' : 'ghost'} onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      <Panel className="scroll-y min-h-0 flex-1 p-4">
        {tab === 'audio' && (
          <>
            <Slider label="Music volume" value={s.musicVolume} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ musicVolume: v })} />
            <Slider label="SFX volume" value={s.sfxVolume} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ sfxVolume: v })} />
          </>
        )}
        {tab === 'gameplay' && (
          <>
            <Toggle label="Vibration" hint="Haptic feedback on hits and pickups (supported devices)" value={s.vibration} onChange={(v) => set({ vibration: v })} />
            <Toggle label="Damage feedback" hint="Red screen flash when the Flamebearer is hurt" value={s.damageFeedback} onChange={(v) => set({ damageFeedback: v })} />
            <Choice label="Effects quality" value={s.effects} options={[{ v: 'high', l: 'High' }, { v: 'low', l: 'Low' }]} onChange={(v) => set({ effects: v as 'high' | 'low' })} />
          </>
        )}
        {tab === 'controls' && (
          <>
            <Slider label="Button size" value={s.buttonSize} min={0.8} max={1.3} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ buttonSize: v })} />
            <Slider label="Button opacity" value={s.buttonOpacity} min={0.3} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ buttonOpacity: v })} />
            <Choice label="Control layout" value={s.controlLayout} options={[{ v: 'default', l: 'Move left · Actions right' }, { v: 'mirrored', l: 'Mirrored' }]} onChange={(v) => set({ controlLayout: v as 'default' | 'mirrored' })} />
            <p className="t-caption mt-3 text-[0.65rem]">Keyboard: A/D or ←/→ move · Space jump · J attack · K / Shift dash · L special · E / ↓ interact · Esc pause</p>
          </>
        )}
        {tab === 'accessibility' && (
          <>
            <Choice label="Text size" value={s.textSize} options={[{ v: 'normal', l: 'Normal' }, { v: 'large', l: 'Large' }]} onChange={(v) => set({ textSize: v as 'normal' | 'large' })} />
            <Toggle label="High contrast HUD" hint="Stronger HUD backgrounds for readability" value={s.highContrast} onChange={(v) => set({ highContrast: v })} />
            <Toggle label="Reduced screen shake" hint="Minimizes camera shake on impacts" value={s.reducedShake} onChange={(v) => set({ reducedShake: v })} />
          </>
        )}
        {tab === 'system' && (
          <div className="flex flex-col gap-3 text-xs">
            <Row label="Language" value="English" />
            <Row label="Save format" value={`v${SAVE_VERSION} · local · versioned with migrations`} />
            <Row label="Build" value="0.1.0 · vertical slice" />
            <div className="border-t border-ash-700/60 pt-3">
              <p className="t-heading mb-1 text-[0.65rem] text-ash-200">Privacy</p>
              <p className="t-caption leading-relaxed">ASHBOUND stores progress only on this device. No personal data is collected. Analytics and crash reporting are disabled in this build.</p>
            </div>
            <div className="border-t border-ash-700/60 pt-3">
              <p className="t-heading mb-1 text-[0.65rem] text-ash-200">Credits</p>
              <p className="t-caption leading-relaxed">Design, engineering, art direction and procedural audio — the ASHBOUND team. Typography: Cinzel & Spectral.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-ash-700/60 pt-3">
              <Button size="sm" onClick={() => actions.grantTestCoins(500)}>
                QA: +500 coins
              </Button>
              {!confirmReset ? (
                <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)}>
                  Reset progress
                </Button>
              ) : (
                <>
                  <span className="t-caption text-blood-500">Erase all progress?</span>
                  <Button size="sm" variant="primary" onClick={() => actions.resetProgress()}>
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );

  if (embedded) return body;
  return (
    <ScreenFrame title="Settings" subtitle="Tune the experience" onBack={onClose ?? (() => actions.navigate('menu'))}>
      {body}
    </ScreenFrame>
  );
}

/* ---------------------------------------------------------------- controls */
function Slider({ label, value, min, max, step, fmt, onChange }: { label: string; value: number; min: number; max: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-ash-100">{label}</span>
        <span className="t-stat text-flame-300">{fmt(value)}</span>
      </div>
      <div className="relative h-6">
        <div className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 bg-ash-800 ring-1 ring-ash-600/50">
          <div className="h-full bg-gradient-to-r from-flame-600 to-flame-400" style={{ width: `${pct}%` }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="absolute inset-0 w-full cursor-pointer opacity-0" aria-label={label} />
        <div className="pointer-events-none absolute top-1/2 h-4 w-2 -translate-x-1/2 -translate-y-1/2 border border-flame-200/70 bg-flame-400 shadow-[0_0_8px_rgba(245,158,43,0.6)]" style={{ left: `${pct}%` }} />
      </div>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="mb-3 flex w-full items-center justify-between gap-4 text-left" onClick={() => { uiSound.click(); onChange(!value); }}>
      <span>
        <span className="block text-xs text-ash-100">{label}</span>
        {hint && <span className="t-caption block text-[0.6rem]">{hint}</span>}
      </span>
      <span className={cn('relative h-5 w-10 shrink-0 border transition', value ? 'border-flame-400 bg-flame-600/40' : 'border-ash-500 bg-ash-800')}>
        <span className={cn('absolute top-0.5 h-3.5 w-3.5 transition-all', value ? 'left-[1.35rem] bg-flame-300' : 'left-0.5 bg-ash-400')} />
      </span>
    </button>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <span className="mb-1.5 block text-xs text-ash-100">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <Button key={o.v} size="sm" selected={value === o.v} variant={value === o.v ? 'default' : 'ghost'} onClick={() => onChange(o.v)}>
            {o.l}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ash-700/50 pb-1.5">
      <span className="t-caption">{label}</span>
      <span className="text-right text-ash-100">{value}</span>
    </div>
  );
}
