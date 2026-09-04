/**
 * ASHBOUND — centralized runtime configuration.
 * All gameplay tuning values live here. Nothing in the runtime should hardcode
 * these numbers.
 */

export const VIEW = {
  /** Logical (virtual) resolution. The canvas is scaled to fit the device. */
  WIDTH: 960,
  HEIGHT: 540,
  MAX_DPR: 2,
} as const;

export const LOOP = {
  FIXED_DT: 1 / 60,
  MAX_FRAME_DT: 0.1,
  MAX_SUBSTEPS: 4,
} as const;

export const PHYSICS = {
  GRAVITY: 2400,
  MAX_FALL: 1300,
  FAST_FALL_MULT: 1.55,
} as const;

export const PLAYER = {
  WIDTH: 30,
  HEIGHT: 58,
  MAX_HP: 100,
  MAX_FLAME: 100,
  FLAME_REGEN_PER_SEC: 4,

  RUN_SPEED: 330,
  ACCEL_GROUND: 3600,
  ACCEL_AIR: 2200,
  FRICTION_GROUND: 3000,
  FRICTION_AIR: 400,

  JUMP_VELOCITY: 800,
  JUMP_CUT_MULT: 0.45,
  DOUBLE_JUMP_VELOCITY: 720,
  COYOTE_TIME: 0.1,
  JUMP_BUFFER: 0.12,

  DASH_SPEED: 900,
  DASH_DURATION: 0.16,
  DASH_COOLDOWN: 0.55,
  DASH_INVULN: 0.16,

  ATTACK_DAMAGE: [16, 18, 30] as readonly number[],
  ATTACK_DURATION: [0.24, 0.24, 0.34] as readonly number[],
  ATTACK_ACTIVE_START: 0.06,
  ATTACK_ACTIVE_END: 0.16,
  ATTACK_COMBO_WINDOW: 0.22,
  ATTACK_BUFFER: 0.18,
  ATTACK_RANGE: 60,
  ATTACK_HEIGHT: 56,
  ATTACK_LUNGE: 140,
  ATTACK_KNOCKBACK: 260,

  SPECIAL_COST: 35,
  SPECIAL_DAMAGE: 45,
  SPECIAL_RADIUS: 120,
  SPECIAL_COOLDOWN: 1.2,

  HURT_DURATION: 0.32,
  HURT_KNOCKBACK_X: 260,
  HURT_KNOCKBACK_Y: 380,
  INVULN_AFTER_HIT: 0.9,

  HAZARD_DAMAGE: 20,
  FALL_DEATH_MARGIN: 200,

  RESPAWN_DELAY: 1.4,
} as const;

export const FEEL = {
  HIT_STOP: 0.055,
  HIT_STOP_HEAVY: 0.09,
  SHAKE_HIT: 3,
  SHAKE_HEAVY: 6,
  SHAKE_LAND: 2,
  SHAKE_DECAY: 12,
  CAMERA_LERP: 6,
  CAMERA_LOOKAHEAD: 90,
  CAMERA_VERTICAL_LERP: 4,
  CAMERA_DEADZONE_Y: 60,
} as const;

export const ENEMY = {
  ASH_GRUNT: {
    WIDTH: 34,
    HEIGHT: 56,
    HP: 48,
    SPEED_PATROL: 60,
    SPEED_CHASE: 150,
    DETECT_RANGE: 260,
    LOSE_RANGE: 420,
    ATTACK_RANGE: 46,
    ATTACK_WINDUP: 0.42,
    ATTACK_ACTIVE: 0.14,
    ATTACK_RECOVER: 0.55,
    ATTACK_DAMAGE: 14,
    STAGGER: 0.28,
    KNOCKBACK: 220,
    COIN_DROP: 12,
    ESSENCE_DROP: 8,
  },
  ASH_BEAST: {
    WIDTH: 62,
    HEIGHT: 40,
    HP: 70,
    SPEED_PATROL: 90,
    SPEED_CHARGE: 420,
    DETECT_RANGE: 320,
    CHARGE_WINDUP: 0.5,
    CHARGE_DURATION: 0.6,
    CHARGE_RECOVER: 0.9,
    ATTACK_DAMAGE: 20,
    STAGGER: 0.4,
    KNOCKBACK: 180,
    COIN_DROP: 20,
    ESSENCE_DROP: 14,
  },
  WARDEN_OF_CINDERS: {
    WIDTH: 58,
    HEIGHT: 90,
    HP: 360,
    POISE: 70,
    SPEED_PATROL: 45,
    SPEED_CHASE: 105,
    DETECT_RANGE: 460,
    LOSE_RANGE: 620,
    ATTACK_RANGE: 78,
    SWING_WINDUP: 0.5,
    SWING_ACTIVE: 0.24,
    SWING_RECOVER: 0.68,
    SWING_DAMAGE: 18,
    SWING_RANGE: 78,
    SLAM_WINDUP: 0.72,
    SLAM_ACTIVE: 0.65,
    SLAM_RECOVER: 0.9,
    SLAM_DAMAGE: 26,
    PILLAR_WINDUP: 0.88,
    PILLAR_ACTIVE: 0.5,
    PILLAR_RECOVER: 0.85,
    PILLAR_DAMAGE: 22,
    STAGGER: 0.58,
    KNOCKBACK: 130,
    COIN_DROP: 80,
    ESSENCE_DROP: 55,
  },
} as const;

export const COLLECT = {
  COIN_VALUE: 5,
  ESSENCE_VALUE: 10,
  HEALTH_ORB_VALUE: 30,
  MAGNET_RADIUS: 70,
  MAGNET_SPEED: 520,
} as const;

export const PARALLAX = {
  SKY: 0,
  MOUNTAINS: 0.08,
  RUINS_FAR: 0.2,
  TREES_FAR: 0.38,
  TREES_MID: 0.6,
  GAMEPLAY: 1,
  FOREGROUND: 1.35,
} as const;

export const PARTICLES = {
  POOL_SIZE: 600,
  AMBIENT_ASH_COUNT: 70,
} as const;

/** Visual palette shared by the renderer to keep the art direction consistent. */
export const PALETTE = {
  skyTop: '#0a0c12',
  skyMid: '#171b26',
  skyBottom: '#2a2e38',
  fog: 'rgba(120,128,148,',
  mountainFar: '#141821',
  mountainNear: '#1b1f29',
  ruinFar: '#1d212b',
  treeFar: '#151820',
  treeMid: '#0f1117',
  ground: '#1e222b',
  groundTop: '#333846',
  groundEdge: '#4a5060',
  stone: '#3a3f4b',
  stoneDark: '#262a33',
  stoneLight: '#4d5361',
  ashGray: '#8a91a3',

  flameCore: '#fff1c4',
  flameHot: '#fbc865',
  flame: '#f59e2b',
  flameDeep: '#ea6a1a',
  flameEdge: '#c2410c',

  hair: '#e9e2d3',
  skin: '#e8c7a8',
  armor: '#1e2028',
  armorLight: '#353946',
  leather: '#4a3527',
  cloak: '#7a1a1c',
  cloakDark: '#4a0f11',
  steel: '#b8bccb',

  enemyBody: '#2b2620',
  enemyBodyLight: '#4a423a',
  enemyEye: '#ff7a1a',
  enemyCorrupt: '#8f2a0c',

  crystal: '#3fb7d9',
  health: '#d9463a',
} as const;
