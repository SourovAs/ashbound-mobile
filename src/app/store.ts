import { useSyncExternalStore } from 'react';
import type { LevelResult } from '../game/types';
import { CHAPTERS, rateLevel, resolvePlayableLevel } from './progression';
import { loadSave, persistSave, type SaveData, type Settings, wipeSave } from './save';

export type Screen = 'menu' | 'levels' | 'character' | 'upgrades' | 'settings' | 'game' | 'credits';

export interface GameLaunch {
  levelId: string;
  checkpointId: string | null;
}

interface AppState {
  screen: Screen;
  save: SaveData;
  launch: GameLaunch | null;
  recovered: 'none' | 'backup' | 'reset';
  notice: string | null;
}

const initial = loadSave();

let state: AppState = {
  screen: 'menu',
  save: initial.data,
  launch: null,
  recovered: initial.recovered,
  notice:
    initial.recovered === 'backup'
      ? 'Save data was restored from backup.'
      : initial.recovered === 'reset'
        ? 'Save data was corrupted and has been reset.'
        : null,
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  emit();
}
function updateSave(fn: (s: SaveData) => SaveData) {
  const save = fn(state.save);
  persistSave(save);
  setState({ save });
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const actions = {
  navigate(screen: Screen) {
    setState({ screen });
  },
  dismissNotice() {
    setState({ notice: null });
  },

  /** Start a level fresh (no checkpoint). */
  playLevel(levelId: string) {
    updateSave((s) => ({ ...s, currentLevel: levelId, checkpoint: null }));
    setState({ launch: { levelId, checkpointId: null }, screen: 'game' });
  },

  /** Continue from saved checkpoint if present. */
  continueGame() {
    const s = state.save;
    const levelId = resolvePlayableLevel(s);
    const checkpointId = s.checkpoint && s.checkpoint.levelId === levelId ? s.checkpoint.id : null;
    setState({ launch: { levelId, checkpointId }, screen: 'game' });
  },

  /** Called when the runtime reports a checkpoint activation. */
  recordCheckpoint(levelId: string, checkpointId: string) {
    updateSave((s) => ({ ...s, currentLevel: levelId, checkpoint: { levelId, id: checkpointId } }));
  },

  recordDeath() {
    updateSave((s) => ({ ...s, stats: { ...s.stats, deaths: s.stats.deaths + 1 } }));
  },

  /** Level complete: bank rewards, unlock next, clear checkpoint. */
  completeLevel(result: LevelResult) {
    const stars = rateLevel(result.timeSec, result.collectiblesFound, result.collectiblesTotal, result.deaths);
    updateSave((s) => {
      const prev = s.levels[result.levelId];
      const next = nextLevelId(result.levelId);
      const unlocked = new Set(s.unlockedLevels);
      if (next) unlocked.add(next);
      return {
        ...s,
        currency: { coins: s.currency.coins + result.coins, essence: s.currency.essence + result.essence },
        checkpoint: null,
        currentLevel: next ?? result.levelId,
        unlockedLevels: [...unlocked],
        levels: {
          ...s.levels,
          [result.levelId]: {
            completed: true,
            bestTimeSec: prev?.bestTimeSec ? Math.min(prev.bestTimeSec, result.timeSec) : result.timeSec,
            collectiblesFound: Math.max(prev?.collectiblesFound ?? 0, result.collectiblesFound),
            collectiblesTotal: result.collectiblesTotal,
            stars: Math.max(prev?.stars ?? 0, stars),
          },
        },
        stats: {
          ...s.stats,
          enemiesDefeated: s.stats.enemiesDefeated + result.enemiesDefeated,
          deaths: s.stats.deaths + result.deaths,
          playtimeSec: s.stats.playtimeSec + result.timeSec,
          levelsCompleted: prev?.completed ? s.stats.levelsCompleted : s.stats.levelsCompleted + 1,
        },
        achievements: withAchievements(s, result),
      };
    });
    return stars;
  },

  buyUpgrade(id: string, cost: number) {
    updateSave((s) => ({
      ...s,
      currency: { ...s.currency, coins: s.currency.coins - cost },
      upgrades: { ...s.upgrades, [id]: (s.upgrades[id] ?? 0) + 1 },
    }));
  },

  updateSettings(patch: Partial<Settings>) {
    updateSave((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },

  resetProgress() {
    wipeSave();
    const fresh = loadSave();
    setState({ save: fresh.data, screen: 'menu', notice: 'Progress has been reset.' });
  },

  /** Debug/QA helper exposed in settings: grants coins for testing upgrades. */
  grantTestCoins(amount: number) {
    updateSave((s) => ({ ...s, currency: { ...s.currency, coins: s.currency.coins + amount } }));
  },
};

function nextLevelId(id: string): string | null {
  const all = CHAPTERS.flatMap((c) => c.levels);
  const i = all.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < all.length ? all[i + 1].id : null;
}

function withAchievements(s: SaveData, r: LevelResult): string[] {
  const a = new Set(s.achievements);
  a.add('first_light');
  if (r.deaths === 0) a.add('unbroken');
  if (r.collectiblesFound === r.collectiblesTotal) a.add('gatherer');
  if (r.enemiesDefeated === r.enemiesTotal) a.add('purifier');
  return [...a];
}

export const ACHIEVEMENTS: Record<string, { name: string; desc: string }> = {
  first_light: { name: 'First Light', desc: 'Complete your first level.' },
  unbroken: { name: 'Unbroken', desc: 'Complete a level without dying.' },
  gatherer: { name: 'Gatherer', desc: 'Collect everything in a level.' },
  purifier: { name: 'Purifier', desc: 'Defeat every enemy in a level.' },
};
