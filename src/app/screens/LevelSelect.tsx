import { cn } from '../../utils/cn';
import { CHAPTERS } from '../progression';
import { actions, useAppState } from '../store';
import { Button, Currency, Icon, Panel, ScreenFrame } from '../ui/primitives';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function LevelSelect() {
  const { save } = useAppState();
  const chapter = CHAPTERS[0];

  return (
    <ScreenFrame title="Levels" subtitle="Choose your path through the ash" onBack={() => actions.navigate('menu')} right={<Currency coins={save.currency.coins} essence={save.currency.essence} compact />}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* Chapter banner */}
        <Panel className="relative shrink-0 overflow-hidden">
          {chapter.image ? (
            <img src={chapter.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
          ) : (
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 30%, ${chapter.accent}33, transparent 60%), linear-gradient(180deg,#13151b,#07080b)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ash-950/90 via-ash-950/60 to-ash-950/30" />
          <div className="relative flex items-center justify-between gap-4 p-4 sm:p-5">
            <div className="min-w-0">
              <p className="t-sub text-[0.6rem]" style={{ color: chapter.accent }}>
                Chapter {chapter.id}
              </p>
              <h2 className="t-title text-lg text-ash-100 sm:text-2xl">{chapter.name}</h2>
              <p className="t-caption truncate">{chapter.mood}</p>
            </div>
            <div className="hidden shrink-0 text-right sm:block">
              <p className="t-stat text-2xl text-flame-400">{chapter.levels.filter((l) => save.levels[l.id]?.completed).length}<span className="text-ash-400">/{chapter.levels.length}</span></p>
              <p className="t-caption text-[0.55rem]">complete</p>
            </div>
          </div>
        </Panel>

        {/* Level grid — responsive: 2 cols on narrow phones, 3 on small, 5 on tablet/desktop */}
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5">
          {chapter.levels.map((l) => {
            const unlocked = save.unlockedLevels.includes(l.id);
            const prog = save.levels[l.id];
            const current = save.currentLevel === l.id;
            const canPlay = unlocked && l.playable;
            return (
              <button
                key={l.id}
                disabled={!canPlay}
                onClick={() => actions.playLevel(l.id)}
                className={cn(
                  'panel-flat group relative flex aspect-[3/4] flex-col justify-between p-2 text-left transition sm:p-3',
                  canPlay && 'hover:border-flame-400/60 hover:shadow-[0_0_18px_rgba(245,158,43,0.2)] active:scale-[0.98]',
                  !unlocked && 'opacity-50',
                  current && 'border-flame-400/70',
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="t-stat text-base text-ash-100 sm:text-lg">{l.id}</span>
                  {!unlocked && <Icon name="lock" size={13} className="text-ash-400" />}
                  {l.boss && unlocked && <Icon name="skull" size={14} className="text-blood-500" />}
                </div>
                <div>
                  <p className="t-heading line-clamp-2 text-[0.55rem] leading-tight text-ash-200 sm:text-[0.62rem]">{l.boss ? 'BOSS · ' : ''}{l.name}</p>
                  <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3].map((s) => (
                      <Icon key={s} name="star" size={10} className={prog && prog.stars >= s ? 'text-flame-400' : 'text-ash-600'} />
                    ))}
                  </div>
                  {prog?.completed ? (
                    <p className="t-caption mt-0.5 text-[0.55rem]">
                      {fmtTime(prog.bestTimeSec ?? 0)} · {prog.collectiblesFound}/{prog.collectiblesTotal}
                    </p>
                  ) : (
                    <p className="t-caption mt-0.5 text-[0.55rem]">{unlocked ? 'Unexplored' : 'Locked'}</p>
                  )}
                </div>
                {current && <span className="absolute -top-1 right-1 bg-flame-500 px-1 text-[0.5rem] font-bold text-ash-950">NOW</span>}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between pt-1">
          <p className="t-caption text-[0.65rem]">Chapter 1 · Five levels · Warden of Cinders boss encounter</p>
          <Button variant="primary" size="sm" onClick={() => actions.playLevel(save.unlockedLevels.filter((id) => chapter.levels.some((l) => l.id === id && l.playable)).slice(-1)[0] ?? '1-1')}>
            Continue
          </Button>
        </div>
      </div>
    </ScreenFrame>
  );
}
