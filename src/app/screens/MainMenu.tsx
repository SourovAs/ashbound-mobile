import { useEffect } from 'react';
import { CHAPTERS, resolvePlayableLevel } from '../progression';
import { actions, useAppState } from '../store';
import { Button, Currency, Embers } from '../ui/primitives';
import { uiSound } from '../ui/uiSound';

export function MainMenu() {
  const { save, notice } = useAppState();
  const hasProgress = !!save.checkpoint || Object.keys(save.levels).length > 0 || save.stats.playtimeSec > 0;
  const playableId = resolvePlayableLevel(save);
  const currentName = CHAPTERS.flatMap((c) => c.levels).find((l) => l.id === playableId)?.name ?? '';

  useEffect(() => {
    uiSound.menuMusic(true);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ash-950" onPointerDown={() => uiSound.unlock()}>
      {/* Key art */}
      <img src="/images/ui_menu_hero.jpg" alt="" className="hero-pan absolute inset-0 h-full w-full object-cover object-[70%_center]" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-r from-ash-950 via-ash-950/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-ash-950 via-transparent to-ash-950/60" />
      <Embers count={26} />
      <div className="vignette absolute inset-0" />

      <div className="safe relative flex h-full flex-col justify-between px-6 py-5 sm:px-10">
        {/* Top bar */}
        <div className="flex items-start justify-between">
          <div className="anim-fade">
            <p className="t-sub text-[0.6rem] text-flame-400/80">Chapter {playableId.split('-')[0]} · {playableId}</p>
            <p className="t-caption">{currentName}</p>
          </div>
          <div className="panel-flat px-3 py-1.5">
            <Currency coins={save.currency.coins} essence={save.currency.essence} compact />
          </div>
        </div>

        {/* Title + primary actions */}
        <div className="flex flex-1 items-center">
          <div className="max-w-md">
            <div className="anim-rise" style={{ animationDelay: '120ms' }}>
              <p className="t-sub mb-1 text-[0.62rem] text-ash-300">A small flame in a world of ash</p>
              <h1 className="t-title anim-flicker text-4xl leading-none text-ash-100 drop-shadow-[0_0_24px_rgba(245,158,43,0.25)] sm:text-6xl">
                Ash<span className="text-flame-400">bound</span>
              </h1>
              <p className="t-heading mt-2 text-[0.7rem] text-flame-300/90 sm:text-xs">The Last Flame</p>
            </div>

            <div className="anim-rise mt-6 flex flex-col gap-2 sm:mt-8" style={{ animationDelay: '260ms' }}>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="lg" className="min-w-[10rem]" onClick={() => actions.playLevel(resolvePlayableLevel(save))}>
                  Play
                </Button>
                <Button size="lg" disabled={!hasProgress} onClick={() => actions.continueGame()} title={save.checkpoint ? 'Resume from checkpoint' : 'Resume'}>
                  Continue
                </Button>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => actions.navigate('levels')}>
                  Levels
                </Button>
                <Button size="sm" onClick={() => actions.navigate('character')}>
                  Character
                </Button>
                <Button size="sm" onClick={() => actions.navigate('upgrades')}>
                  Upgrades
                </Button>
                <Button size="sm" onClick={() => actions.navigate('settings')}>
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-end justify-between">
          <p className="t-caption text-[0.65rem] opacity-70">v0.1.0 · Vertical Slice · Ashen Forest 1-1</p>
          {notice && (
            <button className="panel-flat anim-fade px-3 py-1.5 text-left text-[0.7rem] text-flame-300" onClick={() => actions.dismissNotice()}>
              {notice} <span className="text-ash-400">· dismiss</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
