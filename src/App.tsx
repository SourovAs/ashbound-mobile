import { useEffect, useState } from 'react';
import { Character } from './app/screens/Character';
import { GameScreen } from './app/screens/game/GameScreen';
import { LevelSelect } from './app/screens/LevelSelect';
import { MainMenu } from './app/screens/MainMenu';
import { SettingsScreen } from './app/screens/Settings';
import { Upgrades } from './app/screens/Upgrades';
import { useAppState } from './app/store';
import { uiSound } from './app/ui/uiSound';

/**
 * Application root. Owns navigation between meta screens and the game screen.
 * Gameplay itself lives in the runtime (src/game) and never touches React state
 * per frame.
 */
export default function App() {
  const { screen, save } = useAppState();
  const [booted, setBooted] = useState(false);
  const [portrait, setPortrait] = useState(false);

  // Boot splash (asset warm-up window) + orientation observation
  useEffect(() => {
    const t = window.setTimeout(() => setBooted(true), 1100);
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => setPortrait(mq.matches && window.innerWidth < 900);
    update();
    mq.addEventListener('change', update);
    window.addEventListener('resize', update);
    // Preload key art so menus never pop in
    ['/images/ui_menu_hero.jpg', '/images/ui_chapter_forest.jpg', '/images/ui_portrait_flamebearer.jpg'].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
    return () => {
      clearTimeout(t);
      mq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  // keep app-level audio volumes in sync with settings; suspend when hidden
  useEffect(() => {
    uiSound.setVolumes(save.settings.musicVolume, save.settings.sfxVolume);
  }, [save.settings.musicVolume, save.settings.sfxVolume]);
  useEffect(() => {
    const onVis = () => (document.hidden ? uiSound.suspend() : uiSound.resume());
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Try to lock landscape when supported (Android PWA / fullscreen contexts)
  useEffect(() => {
    const orientation = window.screen.orientation as (ScreenOrientation & { lock?: (o: string) => Promise<void> }) | undefined;
    const lock = orientation?.lock;
    if (typeof lock === 'function') lock.call(orientation, 'landscape').catch(() => undefined);
  }, []);

  const textScale = save.settings.textSize === 'large' ? 'text-[17px]' : 'text-[15px]';

  return (
    <div className={`h-full w-full bg-ash-950 ${textScale}`} onPointerDown={() => uiSound.unlock()}>
      {!booted ? <BootSplash /> : portrait ? <RotatePrompt /> : <Router screen={screen} />}
    </div>
  );
}

function Router({ screen }: { screen: string }) {
  switch (screen) {
    case 'game':
      return <GameScreen />;
    case 'levels':
      return <LevelSelect />;
    case 'character':
      return <Character />;
    case 'upgrades':
      return <Upgrades />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <MainMenu />;
  }
}

function BootSplash() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ash-950">
      <div className="anim-fade text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-flame-500 shadow-[0_0_40px_14px_rgba(234,106,26,0.35)]" />
        <p className="t-title text-lg text-ash-100">
          Ash<span className="text-flame-400">bound</span>
        </p>
        <p className="t-sub mt-1 text-[0.55rem] text-ash-400">Kindling the last flame…</p>
      </div>
    </div>
  );
}

function RotatePrompt() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-ash-950 px-8 text-center">
      <div className="flex h-16 w-24 items-center justify-center border border-ash-500/60 bg-ash-900 shadow-[0_0_30px_rgba(245,158,43,0.15)]">
        <div className="h-3 w-3 animate-pulse rounded-full bg-flame-400" />
      </div>
      <p className="t-heading text-sm text-ash-100">Rotate your device</p>
      <p className="t-caption max-w-xs">ASHBOUND is played in landscape. Turn your device sideways to continue the journey.</p>
    </div>
  );
}
