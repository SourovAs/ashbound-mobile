import { PLAYER } from '../game/config';
import type { PlayerStats } from '../game/types';
import type { SaveData } from './save';

export type UpgradeCategory = 'combat' | 'movement' | 'flame' | 'defense' | 'special';

export interface UpgradeDef {
  id: string;
  name: string;
  category: UpgradeCategory;
  description: string;
  maxLevel: number;
  /** cost per level (coins) */
  costs: number[];
  /** required upgrade ids at level >= 1 */
  requires?: string[];
  /** short effect line per level */
  effect: (level: number) => string;
}

export const UPGRADE_CATEGORIES: { id: UpgradeCategory; label: string }[] = [
  { id: 'combat', label: 'Combat' },
  { id: 'movement', label: 'Movement' },
  { id: 'flame', label: 'Flame' },
  { id: 'defense', label: 'Defense' },
  { id: 'special', label: 'Special' },
];

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'ember_edge',
    name: 'Ember Edge',
    category: 'combat',
    description: 'Temper the blade in living flame. Each strike carries more of the fire.',
    maxLevel: 3,
    costs: [150, 320, 600],
    effect: (l) => `+${l * 12}% attack damage`,
  },
  {
    id: 'flame_strike',
    name: 'Flame Strike',
    category: 'combat',
    description: 'Unleash a concentrated burst of Ash Flame around the Flamebearer.',
    maxLevel: 1,
    costs: [500],
    requires: ['ember_edge'],
    effect: () => 'Unlocks the Special ability (costs 35 Flame)',
  },
  {
    id: 'swift_step',
    name: 'Swift Step',
    category: 'movement',
    description: 'Lighter footing through the ash. Move faster across the ruined world.',
    maxLevel: 2,
    costs: [120, 300],
    effect: (l) => `+${l * 8}% movement speed`,
  },
  {
    id: 'cinder_leap',
    name: 'Cinder Leap',
    category: 'movement',
    description: 'A second leap carried by a burst of flame beneath your feet.',
    maxLevel: 1,
    costs: [400],
    requires: ['swift_step'],
    effect: () => 'Unlocks Double Jump',
  },
  {
    id: 'ash_dash',
    name: 'Ash Dash',
    category: 'movement',
    description: 'The flame recovers faster after each dash.',
    maxLevel: 2,
    costs: [180, 380],
    effect: (l) => `-${l * 20}% dash cooldown`,
  },
  {
    id: 'kindling',
    name: 'Kindling',
    category: 'flame',
    description: 'Feed the flame. Increase your maximum Ash Flame reserve.',
    maxLevel: 3,
    costs: [100, 220, 450],
    effect: (l) => `+${l * 20} max Ash Flame`,
  },
  {
    id: 'ever_burning',
    name: 'Ever-Burning',
    category: 'flame',
    description: 'The flame regenerates on its own, even in stillness.',
    maxLevel: 2,
    costs: [200, 420],
    requires: ['kindling'],
    effect: (l) => `+${l * 50}% flame regeneration`,
  },
  {
    id: 'flame_mastery',
    name: 'Flame Mastery',
    category: 'flame',
    description: 'Deepen your bond with the last flame. Its light grows and the blade ignites.',
    maxLevel: 4,
    costs: [250, 500, 900, 1500],
    requires: ['kindling'],
    effect: (l) => `Flame level ${l + 1}${l + 1 >= 3 ? ' · Blade ignites' : ''}`,
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    category: 'defense',
    description: 'Endure the dying world. Increase maximum health.',
    maxLevel: 3,
    costs: [120, 260, 520],
    effect: (l) => `+${l * 20} max health`,
  },
  {
    id: 'ashen_hide',
    name: 'Ashen Hide',
    category: 'defense',
    description: 'Layers of hardened ash dull incoming blows.',
    maxLevel: 2,
    costs: [300, 600],
    requires: ['iron_will'],
    effect: (l) => `-${l * 10}% damage taken`,
  },
  {
    id: 'pyre_heart',
    name: 'Pyre Heart',
    category: 'special',
    description: 'Flame Strike burns hotter and wider.',
    maxLevel: 2,
    costs: [600, 1100],
    requires: ['flame_strike'],
    effect: (l) => `+${l * 25}% special damage`,
  },
];

export function upgradeLevel(save: SaveData, id: string) {
  return save.upgrades[id] ?? 0;
}

export function upgradeUnlocked(save: SaveData, u: UpgradeDef) {
  return (u.requires ?? []).every((r) => upgradeLevel(save, r) >= 1);
}

export function upgradeCost(save: SaveData, u: UpgradeDef): number | null {
  const l = upgradeLevel(save, u.id);
  if (l >= u.maxLevel) return null;
  return u.costs[l];
}

export function canBuy(save: SaveData, u: UpgradeDef) {
  const cost = upgradeCost(save, u);
  return cost !== null && upgradeUnlocked(save, u) && save.currency.coins >= cost;
}

/** Derive the runtime PlayerStats from purchased upgrades. */
export function computeStats(save: SaveData): PlayerStats {
  const L = (id: string) => upgradeLevel(save, id);
  const flameLevel = 1 + L('flame_mastery');
  return {
    maxHp: PLAYER.MAX_HP + L('iron_will') * 20,
    maxFlame: PLAYER.MAX_FLAME + L('kindling') * 20,
    attackMult: (1 + L('ember_edge') * 0.12) * (1 + (flameLevel - 1) * 0.04),
    moveMult: 1 + L('swift_step') * 0.08,
    dashCooldownMult: 1 - L('ash_dash') * 0.2,
    flameRegenMult: 1 + L('ever_burning') * 0.5,
    doubleJump: L('cinder_leap') >= 1,
    specialUnlocked: L('flame_strike') >= 1,
    damageTakenMult: 1 - L('ashen_hide') * 0.1,
    flameLevel,
  };
}

export const FLAME_LEVEL_NAMES = ['Unstable Ember', 'Steady Flame', 'Burning Edge', 'Radiant Fire', 'Mastered Ash Flame'];

/* ------------------------------------------------------------ level catalog */
export interface LevelMeta {
  id: string;
  chapter: number;
  index: number;
  name: string;
  boss?: boolean;
  playable: boolean;
}
export interface ChapterMeta {
  id: number;
  name: string;
  mood: string;
  image: string | null;
  accent: string;
  levels: LevelMeta[];
}

const mk = (ch: number, names: string[], playable: number): LevelMeta[] =>
  names.map((name, i) => ({ id: `${ch}-${i + 1}`, chapter: ch, index: i + 1, name, boss: i === names.length - 1, playable: i < playable }));

export const CHAPTERS: ChapterMeta[] = [
  {
    id: 1,
    name: 'Ashen Forest',
    mood: 'Mysterious · Quiet · Dangerous',
    image: '/images/ui_chapter_forest.jpg',
    accent: '#8a91a3',
    levels: mk(1, ['The Waking Ember', 'Roots of Ash', 'The Hollow Path', 'Broken Watch', 'Warden of Cinders'], 5),
  },
];

/** Latest level that is both unlocked in the save and actually playable in this build. */
export function resolvePlayableLevel(save: SaveData): string {
  const all = CHAPTERS.flatMap((c) => c.levels);
  const current = all.find((l) => l.id === save.currentLevel);
  if (current?.playable && save.unlockedLevels.includes(current.id)) return current.id;
  const candidates = all.filter((l) => l.playable && save.unlockedLevels.includes(l.id));
  return candidates.length ? candidates[candidates.length - 1].id : '1-1';
}

export function levelMeta(id: string): LevelMeta | undefined {
  for (const c of CHAPTERS) for (const l of c.levels) if (l.id === id) return l;
  return undefined;
}

/** The final playable level id. Used to detect campaign completion. */
export const LAST_LEVEL_ID = (() => {
  const all = CHAPTERS.flatMap((c) => c.levels).filter((l) => l.playable);
  return all[all.length - 1]?.id ?? '1-1';
})();

export function isLastLevel(id: string): boolean {
  return id === LAST_LEVEL_ID;
}

/** Star rating for a completed level. */
export function rateLevel(timeSec: number, collectiblesFound: number, collectiblesTotal: number, deaths: number) {
  let stars = 1;
  if (collectiblesFound / Math.max(1, collectiblesTotal) >= 0.7) stars++;
  if (deaths === 0 || timeSec < 150) stars++;
  return Math.min(3, stars);
}
