import { useCallback, useEffect, useRef, useState } from 'react';
import { GameRuntime } from '../../../game/engine';
import { FOREST_1_1 } from '../../../game/levels/forest_1_1';
import type { HudSnapshot, LevelDef, LevelResult, RuntimeEvent } from '../../../game/types';
import { cn } from '../../../utils/cn';
import { computeStats, levelMeta, rateLevel } from '../../progression';
import { actions, useAppState } from '../../store';
import { Button, Embers, Icon, Panel } from '../../ui/primitives';
import { uiSound } from '../../ui/uiSound';
import { SettingsScreen } from '../Settings';
import { Hud } from './Hud';
import { VirtualControls } from './VirtualControls';

const LEVELS: Record<string, LevelDef> = { '1-1': FOREST_1_1 };

type Overlay = 'none' | 'pause' | 'settings' | 'death' | 'victory';

const emptyHud: HudSnapshot = { hp: 100, maxHp: 100, flame: 60, maxFlame: 100, coins: 0, essence: 0, objective: '', dashCooldown: 1, specialReady: false, canInteract: false, enemiesLeft: 0 };

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;

export function GameScreen() {
  const { save, launch } = useAppState();
  const levelId = launch?.levelId ?? '1-1';
  const level = LEVELS[levelId] ?? FOREST_1_1;
  const meta = levelMeta(level.id);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(emptyHud);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [result, setResult] = useState<LevelResult | null>(null);
  const [stars, setStars] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [intro, setIntro] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const settingsRef = useRef(save.settings);
  settingsRef.current = save.settings;

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }, []);

  const doPause = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt || rt.isPaused) return;
    rt.pause();
    setOverlay('pause');
  }, []);

  // ---- runtime lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    uiSound.menuMusic(false);

    const onEvent = (e: RuntimeEvent) => {
      switch (e.type) {
        case 'hud':
          setHud(e.hud);
          break;
        case 'toast':
          if (e.text === '__pause__') doPause();
          else showToast(e.text);
          break;
        case 'hitflash':
          if (settingsRef.current.damageFeedback) setFlash((f) => f + 1);
          if (settingsRef.current.vibration && navigator.vibrate) navigator.vibrate(30);
          break;
        case 'checkpoint':
          actions.recordCheckpoint(level.id, e.checkpoint.id);
          showToast('Checkpoint kindled — progress saved');
          break;
        case 'death':
          actions.recordDeath();
          setOverlay('death');
          break;
        case 'respawn':
          setOverlay('none');
          break;
        case 'victory': {
          const s = actions.completeLevel(e.result);
          setStars(s);
          setResult(e.result);
          setOverlay('victory');
          break;
        }
      }
    };

    let rt: GameRuntime;
    try {
      rt = new GameRuntime(canvas, container, {
        level,
        stats: computeStats(save),
        checkpointId: launch?.checkpointId ?? null,
        settings: {
          musicVolume: save.settings.musicVolume,
          sfxVolume: save.settings.sfxVolume,
          reducedShake: save.settings.reducedShake,
          showHitFlash: save.settings.damageFeedback,
        },
        onEvent,
      });
    } catch (err) {
      console.error('[runtime] failed to start', err);
      setFatal(err instanceof Error ? err.message : 'Unknown error');
      return;
    }
    runtimeRef.current = rt;
    const introTimer = window.setTimeout(() => {
      setIntro(false);
      rt.start();
    }, 1400);

    return () => {
      clearTimeout(introTimer);
      rt.destroy();
      runtimeRef.current = null;
    };
    // The runtime is created once per launch; settings are pushed via updateSettings below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, launch?.checkpointId]);

  // push live settings to the runtime
  useEffect(() => {
    runtimeRef.current?.updateSettings({ musicVolume: save.settings.musicVolume, sfxVolume: save.settings.sfxVolume, reducedShake: save.settings.reducedShake });
  }, [save.settings.musicVolume, save.settings.sfxVolume, save.settings.reducedShake]);

  // pause when the app is backgrounded
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) doPause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [doPause]);

  const setVirtual = useCallback((a: Parameters<GameRuntime['setVirtual']>[0], on: boolean) => runtimeRef.current?.setVirtual(a, on), []);
  const setAxis = useCallback((v: number) => runtimeRef.current?.setVirtualAxis(v), []);

  const resume = () => {
    setOverlay('none');
    runtimeRef.current?.resume();
  };
  const exitToMenu = () => {
    actions.navigate('menu');
  };

  const stats = computeStats(save);
  const levelLabel = `${level.id} · ${meta?.name ?? level.name}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-ash-950">
      <div ref={containerRef} className="absolute inset-0 flex items-center justify-center">
        <canvas ref={canvasRef} className="block" style={{ imageRendering: 'auto' }} />
      </div>

      {/* damage flash */}
      {flash > 0 && <div key={flash} className="hit-flash pointer-events-none absolute inset-0" />}

      {/* HUD */}
      {!fatal && <Hud hud={hud} settings={save.settings} onPause={doPause} levelLabel={levelLabel} />}

      {/* Touch controls */}
      {!fatal && overlay === 'none' && !intro && (
        <VirtualControls settings={save.settings} dashCooldown={hud.dashCooldown} specialReady={hud.specialReady} specialUnlocked={stats.specialUnlocked} canInteract={hud.canInteract} setVirtual={setVirtual} setAxis={setAxis} />
      )}

      {/* Toast */}
      <div className={cn('pointer-events-none absolute bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 transition-all duration-300', toast ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0')}>
        <div className="panel-flat border-flame-500/40 px-4 py-2 text-center text-xs text-flame-100">{toast}</div>
      </div>

      {/* Level intro */}
      <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center bg-ash-950 transition-opacity duration-700', intro ? 'opacity-100' : 'opacity-0')}>
        <div className="anim-rise text-center">
          <p className="t-sub text-[0.65rem] text-flame-400">Chapter {level.chapter} · Ashen Forest</p>
          <h2 className="t-title mt-1 text-2xl text-ash-100 sm:text-4xl">{level.id} — {level.name}</h2>
          <p className="t-caption mt-2">{level.objective}</p>
        </div>
      </div>

      {/* Overlays */}
      {overlay === 'pause' && (
        <OverlayFrame>
          <Panel className="w-[22rem] max-w-[90vw] p-5 text-center">
            <p className="t-sub text-[0.6rem] text-flame-400">Paused</p>
            <h2 className="t-title text-xl text-ash-100">The flame waits</h2>
            <p className="t-caption mt-1">{levelLabel}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="primary" onClick={resume}>
                Resume
              </Button>
              <Button onClick={() => runtimeRef.current?.restart()}>Restart Level</Button>
              <Button onClick={() => setOverlay('settings')}>Settings</Button>
              <Button variant="ghost" onClick={exitToMenu}>
                Exit to Menu
              </Button>
            </div>
          </Panel>
        </OverlayFrame>
      )}

      {overlay === 'settings' && (
        <OverlayFrame>
          <div className="flex h-[85%] w-[min(56rem,94vw)] flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="t-heading text-sm text-ash-100">Settings</h2>
              <Button size="sm" onClick={() => setOverlay('pause')}>
                Back
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <SettingsScreen embedded />
            </div>
          </div>
        </OverlayFrame>
      )}

      {overlay === 'death' && (
        <OverlayFrame dark>
          <div className="anim-rise w-[24rem] max-w-[92vw] text-center">
            <p className="t-sub text-[0.65rem] text-blood-500">The flame fades</p>
            <h2 className="t-title text-3xl text-ash-100">You Fell</h2>
            <p className="t-caption mt-2">
              {hud.coins} coins · {hud.essence} essence carried · {save.checkpoint ? 'Checkpoint kindled' : 'No checkpoint yet'}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="primary" size="lg" onClick={() => runtimeRef.current?.respawn()}>
                Rekindle at Checkpoint
              </Button>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => runtimeRef.current?.restart()}>
                  Restart Level
                </Button>
                <Button variant="ghost" className="flex-1" onClick={exitToMenu}>
                  Exit
                </Button>
              </div>
            </div>
          </div>
        </OverlayFrame>
      )}

      {overlay === 'victory' && result && (
        <OverlayFrame>
          <Embers count={30} />
          <Panel className="anim-rise relative w-[30rem] max-w-[94vw] p-5">
            <div className="text-center">
              <p className="t-sub text-[0.65rem] text-flame-400">Level Complete</p>
              <h2 className="t-title text-2xl text-ash-100">{level.name}</h2>
              <div className="mt-2 flex justify-center gap-1">
                {[1, 2, 3].map((s) => (
                  <Icon key={s} name="star" size={26} className={cn('transition-all', stars >= s ? 'text-flame-400 drop-shadow-[0_0_10px_rgba(245,158,43,0.7)]' : 'text-ash-600')} />
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
              <Stat icon="clock" label="Time" v={fmtTime(result.timeSec)} />
              <Stat icon="skull" label="Enemies" v={`${result.enemiesDefeated} / ${result.enemiesTotal}`} />
              <Stat icon="coin" label="Ash Coins" v={`+${result.coins}`} />
              <Stat icon="essence" label="Flame Essence" v={`+${result.essence}`} />
              <Stat icon="star" label="Collectibles" v={`${result.collectiblesFound} / ${result.collectiblesTotal}`} />
              <Stat icon="flame" label="Deaths" v={`${result.deaths}`} />
            </div>
            <p className="t-caption mt-3 text-center text-[0.65rem]">
              Performance: {rateLevel(result.timeSec, result.collectiblesFound, result.collectiblesTotal, result.deaths) === 3 ? 'Flawless — the flame burns bright.' : stars === 2 ? 'Strong — the ash yields.' : 'Survived — carry the flame onward.'}
            </p>
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={() => runtimeRef.current?.restart()}>
                Replay
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => actions.navigate('upgrades')}>
                Upgrades
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => actions.navigate('levels')}>
                Next Level
              </Button>
            </div>
          </Panel>
        </OverlayFrame>
      )}

      {fatal && (
        <OverlayFrame dark>
          <Panel className="w-[24rem] max-w-[92vw] p-5 text-center">
            <p className="t-sub text-[0.6rem] text-blood-500">Runtime error</p>
            <h2 className="t-title text-lg text-ash-100">The flame could not be lit</h2>
            <p className="t-caption mt-2">{fatal}</p>
            <Button className="mt-4" onClick={exitToMenu}>
              Return to Menu
            </Button>
          </Panel>
        </OverlayFrame>
      )}
    </div>
  );
}

function OverlayFrame({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={cn('anim-fade safe absolute inset-0 flex items-center justify-center', dark ? 'bg-ash-950/85' : 'bg-ash-950/60 backdrop-blur-[3px]')} style={{ animationDuration: '250ms' }}>
      {children}
    </div>
  );
}

function Stat({ icon, label, v }: { icon: 'clock' | 'skull' | 'coin' | 'essence' | 'star' | 'flame'; label: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ash-700/50 pb-1">
      <span className="flex items-center gap-1.5 text-ash-300">
        <Icon name={icon} size={14} />
        <span className="t-caption">{label}</span>
      </span>
      <span className="t-stat text-ash-100">{v}</span>
    </div>
  );
}
