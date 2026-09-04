/**
 * Versioned local save system with migrations and graceful corruption recovery.
 * Storage backend is abstracted so an Android build can swap localStorage for
 * a native store without touching callers.
 */

export const SAVE_VERSION = 2;
const SAVE_KEY = 'ashbound.save';
const BACKUP_KEY = 'ashbound.save.bak';

export interface LevelProgress {
  completed: boolean;
  bestTimeSec: number | null;
  collectiblesFound: number;
  collectiblesTotal: number;
  stars: number; // 0..3
}

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  vibration: boolean;
  damageFeedback: boolean;
  effects: 'high' | 'low';
  buttonSize: number; // 0.8..1.3
  buttonOpacity: number; // 0.3..1
  controlLayout: 'default' | 'mirrored';
  textSize: 'normal' | 'large';
  highContrast: boolean;
  reducedShake: boolean;
  language: 'en';
}

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  currency: { coins: number; essence: number };
  currentLevel: string;
  checkpoint: { levelId: string; id: string } | null;
  unlockedLevels: string[];
  levels: Record<string, LevelProgress>;
  upgrades: Record<string, number>;
  achievements: string[];
  stats: { enemiesDefeated: number; deaths: number; playtimeSec: number; levelsCompleted: number };
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  musicVolume: 0.7,
  sfxVolume: 0.9,
  vibration: true,
  damageFeedback: true,
  effects: 'high',
  buttonSize: 1,
  buttonOpacity: 0.75,
  controlLayout: 'default',
  textSize: 'normal',
  highContrast: false,
  reducedShake: false,
  language: 'en',
};

export function createDefaultSave(): SaveData {
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    currency: { coins: 0, essence: 0 },
    currentLevel: '1-1',
    checkpoint: null,
    unlockedLevels: ['1-1'],
    levels: {},
    upgrades: {},
    achievements: [],
    stats: { enemiesDefeated: 0, deaths: 0, playtimeSec: 0, levelsCompleted: 0 },
    settings: { ...DEFAULT_SETTINGS },
  };
}

/* ------------------------------------------------------------ storage backend */
interface StorageBackend {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const memory = new Map<string, string>();
const backend: StorageBackend = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

/* ------------------------------------------------------------ migrations */
type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Index = version to migrate FROM. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: settings gained accessibility fields; stats gained levelsCompleted
  1: (d) => {
    const settings = { ...DEFAULT_SETTINGS, ...((d.settings as object) ?? {}) };
    const stats = { enemiesDefeated: 0, deaths: 0, playtimeSec: 0, levelsCompleted: 0, ...((d.stats as object) ?? {}) };
    return { ...d, settings, stats, version: 2 };
  },
};

function migrate(raw: Record<string, unknown>): SaveData {
  let data = raw;
  let v = typeof data.version === 'number' ? data.version : 1;
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`No migration from save version ${v}`);
    data = m(data);
    v = data.version as number;
  }
  return validate(data);
}

/** Structural validation & repair. Fills gaps with defaults instead of failing. */
function validate(d: Record<string, unknown>): SaveData {
  const def = createDefaultSave();
  const num = (v: unknown, fb: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
  const cur = (d.currency as Record<string, unknown>) ?? {};
  const st = (d.stats as Record<string, unknown>) ?? {};
  const settings = { ...def.settings, ...((typeof d.settings === 'object' && d.settings) || {}) } as Settings;
  settings.musicVolume = Math.min(1, Math.max(0, num(settings.musicVolume, def.settings.musicVolume)));
  settings.sfxVolume = Math.min(1, Math.max(0, num(settings.sfxVolume, def.settings.sfxVolume)));
  settings.buttonSize = Math.min(1.3, Math.max(0.8, num(settings.buttonSize, 1)));
  settings.buttonOpacity = Math.min(1, Math.max(0.3, num(settings.buttonOpacity, 0.75)));

  const unlocked = Array.isArray(d.unlockedLevels) ? (d.unlockedLevels as string[]).filter((x) => typeof x === 'string') : [];
  if (!unlocked.includes('1-1')) unlocked.unshift('1-1');

  return {
    version: SAVE_VERSION,
    createdAt: num(d.createdAt, def.createdAt),
    updatedAt: num(d.updatedAt, def.updatedAt),
    currency: { coins: Math.max(0, Math.floor(num(cur.coins, 0))), essence: Math.max(0, Math.floor(num(cur.essence, 0))) },
    currentLevel: typeof d.currentLevel === 'string' ? d.currentLevel : '1-1',
    checkpoint:
      d.checkpoint && typeof d.checkpoint === 'object' && typeof (d.checkpoint as { id?: unknown }).id === 'string'
        ? (d.checkpoint as SaveData['checkpoint'])
        : null,
    unlockedLevels: unlocked,
    levels: typeof d.levels === 'object' && d.levels ? (d.levels as SaveData['levels']) : {},
    upgrades: typeof d.upgrades === 'object' && d.upgrades ? (d.upgrades as SaveData['upgrades']) : {},
    achievements: Array.isArray(d.achievements) ? (d.achievements as string[]) : [],
    stats: {
      enemiesDefeated: num(st.enemiesDefeated, 0),
      deaths: num(st.deaths, 0),
      playtimeSec: num(st.playtimeSec, 0),
      levelsCompleted: num(st.levelsCompleted, 0),
    },
    settings,
  };
}

/* ------------------------------------------------------------ API */
export interface LoadResult {
  data: SaveData;
  recovered: 'none' | 'backup' | 'reset';
}

export function loadSave(): LoadResult {
  const tryParse = (raw: string | null): SaveData | null => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return migrate(parsed as Record<string, unknown>);
    } catch (err) {
      console.warn('[save] failed to parse save', err);
      return null;
    }
  };
  const primary = tryParse(backend.get(SAVE_KEY));
  if (primary) return { data: primary, recovered: 'none' };
  const backup = tryParse(backend.get(BACKUP_KEY));
  if (backup) {
    persistSave(backup);
    return { data: backup, recovered: 'backup' };
  }
  const fresh = createDefaultSave();
  persistSave(fresh);
  return { data: fresh, recovered: backend.get(SAVE_KEY) || backend.get(BACKUP_KEY) ? 'reset' : 'none' };
}

export function persistSave(data: SaveData) {
  try {
    const prev = backend.get(SAVE_KEY);
    if (prev) backend.set(BACKUP_KEY, prev);
    backend.set(SAVE_KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
  } catch (err) {
    console.error('[save] persist failed', err);
  }
}

export function wipeSave() {
  backend.remove(SAVE_KEY);
  backend.remove(BACKUP_KEY);
}
