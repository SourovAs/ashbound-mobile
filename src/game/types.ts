/** Shared runtime types. Keep runtime state completely separate from React state. */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Facing = 1 | -1;

export type PlayerAnim =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'dash'
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'special'
  | 'hurt'
  | 'dead'
  | 'interact'
  | 'victory';

export type EnemyKind = 'ash_grunt' | 'ash_beast';

export type EnemyState =
  | 'patrol'
  | 'alert'
  | 'chase'
  | 'windup'
  | 'attack'
  | 'recover'
  | 'stagger'
  | 'dead';

export type CollectibleKind = 'coin' | 'essence' | 'health';

export interface SolidDef extends Rect {
  /** one-way platforms can be jumped through from below */
  oneWay?: boolean;
  kind?: 'stone' | 'wood' | 'cracked' | 'ground';
}

export interface HazardDef extends Rect {
  kind: 'spikes' | 'fire';
}

export interface EnemySpawnDef {
  kind: EnemyKind;
  x: number;
  y: number;
  patrolMin: number;
  patrolMax: number;
}

export interface CollectibleDef {
  kind: CollectibleKind;
  x: number;
  y: number;
}

export interface CheckpointDef {
  id: string;
  x: number;
  y: number;
}

export interface InteractableDef {
  id: string;
  kind: 'flame_altar' | 'lever';
  x: number;
  y: number;
  /** id of the gate this interactable opens */
  opens?: string;
  flameCost?: number;
}

export interface GateDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PropDef {
  kind: 'ruin_wall' | 'pillar' | 'arch' | 'crate' | 'barrel' | 'lantern' | 'bones' | 'banner' | 'cart' | 'tree_dead';
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
}

export interface LevelDef {
  id: string;
  chapter: number;
  index: number;
  name: string;
  objective: string;
  width: number;
  height: number;
  spawn: { x: number; y: number };
  solids: SolidDef[];
  hazards: HazardDef[];
  enemies: EnemySpawnDef[];
  collectibles: CollectibleDef[];
  checkpoints: CheckpointDef[];
  interactables: InteractableDef[];
  gates: GateDef[];
  props: PropDef[];
  exit: Rect;
  /** deterministic decoration seed */
  seed: number;
}

/** Stats provided by the application layer (upgrades / progression). */
export interface PlayerStats {
  maxHp: number;
  maxFlame: number;
  attackMult: number;
  moveMult: number;
  dashCooldownMult: number;
  flameRegenMult: number;
  doubleJump: boolean;
  specialUnlocked: boolean;
  damageTakenMult: number;
  flameLevel: number;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  flame: number;
  maxFlame: number;
  coins: number;
  essence: number;
  objective: string;
  dashCooldown: number; // 0..1 (1 = ready)
  specialReady: boolean;
  canInteract: boolean;
  enemiesLeft: number;
}

export interface LevelResult {
  levelId: string;
  timeSec: number;
  enemiesDefeated: number;
  enemiesTotal: number;
  coins: number;
  essence: number;
  collectiblesFound: number;
  collectiblesTotal: number;
  deaths: number;
}

export interface CheckpointSnapshot {
  id: string;
  x: number;
  y: number;
}

export type RuntimeEvent =
  | { type: 'hud'; hud: HudSnapshot }
  | { type: 'death'; deaths: number }
  | { type: 'respawn' }
  | { type: 'checkpoint'; checkpoint: CheckpointSnapshot; coins: number; essence: number }
  | { type: 'victory'; result: LevelResult }
  | { type: 'toast'; text: string }
  | { type: 'hitflash' };

export type RuntimeListener = (e: RuntimeEvent) => void;
