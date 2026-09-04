import { useState } from 'react';
import { cn } from '../../utils/cn';
import { CHAPTERS } from '../progression';
import { actions, useAppState } from '../store';
import { Button, Currency, Icon, Panel, ScreenFrame } from '../ui/primitives';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function LevelSelect() {
  const { save } = useAppState();
  const [chapterId, setChapterId] = useState(() => Number(save.currentLevel.split('-')[0]) || 1);
  const chapter = CHAPTERS.find((c) => c.id === chapterId) ?? CHAPTERS[0];
  const chapterUnlocked = chapter.levels.some((l) => save.unlockedLevels.includes(l.id));

  return (
    <ScreenFrame title="Levels" subtitle="Choose your path through the ash" onBack={() => actions.navigate('menu')} right={<Currency coins={save.currency.coins} essence={save.currency.essence} compact />}>
      <div className="flex h-full min-h-0 gap-4">
        {/* Chapter rail */}
        <div className="flex w-40 shrink-0 flex-col gap-1.5 sm:w-52">
          {CHAPTERS.map((c) => {
            const unlocked = c.levels.some((l) => save.unlockedLevels.includes(l.id));
            const done = c.levels.filter((l) => save.levels[l.id]?.completed).length;
            return (
              <button
                key={c.id}
                onClick={() => setChapterId(c.id)}
                className={cn(
                  'panel-flat relative flex items-center gap-2 px-3 py-2 text-left transition',
                  chapterId === c.id && 'border-flame-400/60 shadow-[0_0_16px_rgba(245,158,43,0.15)]',
                  !unlocked && 'opacity-60',
                )}
              >
                <span className="h-8 w-1 shrink-0 rounded-sm" style={{ background: c.accent }} />
                <span className="min-w-0 flex-1">
                  <span className="t-caption block text-[0.58rem]">Chapter {c.id}</span>
                  <span className="t-heading block truncate text-[0.68rem] text-ash-100">{c.name}</span>
                  <span className="t-caption block text-[0.58rem]">{done}/{c.levels.length} complete</span>
                </span>
                {!unlocked && <Icon name="lock" size={14} className="text-ash-400" />}
              </button>
            );
          })}
        </div>

        {/* Chapter content */}
        <Panel className="relative min-w-0 flex-1 overflow-hidden">
          {chapter.image ? (
            <img src={chapter.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
          ) : (
            <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 30%, ${chapter.accent}33, transparent 60%), linear-gradient(180deg,#13151b,#07080b)` }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ash-950/90 via-ash-950/60 to-ash-950/30" />
          <div className="relative flex h-full flex-col p-4 sm:p-5">
            <div className="mb-3">
              <p className="t-sub text-[0.6rem]" style={{ color: chapter.accent }}>
                Chapter {chapter.id}
              </p>
              <h2 className="t-title text-lg text-ash-100 sm:text-2xl">{chapter.name}</h2>
              <p className="t-caption">{chapter.mood}</p>
            </div>

            {!chapterUnlocked ? (
              <div className="flex flex-1 items-center justify-center">
                <div className="panel-flat flex items-center gap-3 px-5 py-3">
                  <Icon name="lock" size={20} className="text-ash-300" />
                  <div>
                    <p className="t-heading text-xs text-ash-100">Sealed by ash</p>
                    <p className="t-caption">Complete the previous chapter to continue the journey.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
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
                        'panel-flat group relative flex aspect-[3/4] flex-col justify-between p-2 text-left transition',
                        canPlay && 'hover:border-flame-400/60 hover:shadow-[0_0_18px_rgba(245,158,43,0.2)] active:scale-[0.98]',
                        !unlocked && 'opacity-50',
                        current && 'border-flame-400/70',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <span className="t-stat text-base text-ash-100">{l.id}</span>
                        {!unlocked && <Icon name="lock" size={13} className="text-ash-400" />}
                        {l.boss && unlocked && <Icon name="skull" size={14} className="text-blood-500" />}
                      </div>
                      <div>
                        <p className="t-heading line-clamp-2 text-[0.55rem] leading-tight text-ash-200">{l.boss ? 'BOSS · ' : ''}{l.name}</p>
                        <div className="mt-1 flex gap-0.5">
                          {[1, 2, 3].map((s) => (
                            <Icon key={s} name="star" size={10} className={prog && prog.stars >= s ? 'text-flame-400' : 'text-ash-600'} />
                          ))}
                        </div>
                        {prog?.completed ? (
                          <p className="t-caption mt-0.5 text-[0.55rem]">
                            {fmtTime(prog.bestTimeSec ?? 0)} · {prog.collectiblesFound}/{prog.collectiblesTotal}
                          </p>
                        ) : unlocked && !l.playable ? (
                          <p className="t-caption mt-0.5 text-[0.55rem] text-flame-300/70">In production</p>
                        ) : (
                          <p className="t-caption mt-0.5 text-[0.55rem]">{unlocked ? 'Unexplored' : 'Locked'}</p>
                        )}
                      </div>
                      {current && <span className="absolute -top-1 right-1 bg-flame-500 px-1 text-[0.5rem] font-bold text-ash-950">NOW</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-auto flex items-center justify-between pt-3">
              <p className="t-caption text-[0.65rem]">
                {chapter.id === 1 ? 'Vertical slice: 1-1 is fully playable. Further levels unlock as production continues.' : 'Content in production.'}
              </p>
              {chapterUnlocked && (
                <Button variant="primary" size="sm" onClick={() => actions.playLevel(chapter.levels.find((l) => save.unlockedLevels.includes(l.id) && l.playable)?.id ?? '1-1')}>
                  Enter Chapter
                </Button>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </ScreenFrame>
  );
}
