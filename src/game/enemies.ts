import { ENEMY, PHYSICS } from './config';
import { groundAhead, moveBody, overlaps, wallAhead, type Body } from './physics';
import type { Player } from './player';
import type { EnemyKind, EnemySpawnDef, EnemyState, Facing, Rect, SolidDef } from './types';
import type { WorldServices } from './world';

/**
 * Reusable enemy framework. Subclasses configure stats and override the
 * attack behaviour; the FSM, damage handling, stagger and death are shared.
 */
export abstract class Enemy {
  abstract readonly kind: EnemyKind;
  body: Body;
  facing: Facing = -1;
  state: EnemyState = 'patrol';
  stateTime = 0;
  hp: number;
  maxHp: number;
  hitFlash = 0;
  dead = false;
  removeMe = false;
  deathTimer = 0;
  patrolMin: number;
  patrolMax: number;
  coinDrop: number;
  essenceDrop: number;
  /** used by renderer for anim */
  animTime = 0;
  protected knockback = 0;
  protected staggerTime = 0;

  constructor(def: EnemySpawnDef, w: number, h: number, hp: number, coin: number, essence: number) {
    this.body = { x: def.x, y: def.y, w, h, vx: 0, vy: 0, grounded: false, wallDir: 0, hitCeiling: false };
    this.hp = hp;
    this.maxHp = hp;
    this.patrolMin = def.patrolMin;
    this.patrolMax = def.patrolMax;
    this.coinDrop = coin;
    this.essenceDrop = essence;
    this.facing = Math.random() < 0.5 ? 1 : -1;
  }

  get centerX() {
    return this.body.x + this.body.w / 2;
  }
  get centerY() {
    return this.body.y + this.body.h / 2;
  }

  protected setState(s: EnemyState) {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
  }

  /** Hitbox used when this enemy is in its active attack frames. */
  abstract attackHitbox(): Rect | null;
  abstract contactDamage(): number;
  protected abstract think(dt: number, player: Player, solids: readonly SolidDef[], w: WorldServices): void;

  /** Whether the enemy can be hurt from the given side (shield logic etc). */
  canBeHitFrom(_fromX: number): boolean {
    return true;
  }

  takeDamage(amount: number, fromX: number, w: WorldServices, heavy = false) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlash = 0.12;
    const dir = fromX < this.centerX ? 1 : -1;
    this.body.vx = dir * this.knockback * (heavy ? 1.6 : 1);
    if (heavy) this.body.vy = -220;
    w.particles.emit('spark', this.centerX, this.centerY, 8, { speed: 240, life: 0.3, size: 2.5 });
    w.particles.emit('flame', this.centerX, this.centerY, 6, { speed: 120, life: 0.35, size: 4 });
    w.particles.emit('shard', this.centerX, this.centerY, 4, { speed: 160, life: 0.7, size: 3 });
    w.audio.play(heavy ? 'hit_heavy' : 'hit');
    if (this.hp <= 0) {
      this.die(w);
    } else {
      this.staggerTime = this.staggerDuration();
      this.setState('stagger');
      this.facing = (-dir) as Facing;
    }
  }

  protected abstract staggerDuration(): number;

  protected die(w: WorldServices) {
    this.dead = true;
    this.hp = 0;
    this.setState('dead');
    this.deathTimer = 0.7;
    w.audio.play('enemy_death');
    w.particles.emit('smoke', this.centerX, this.centerY, 14, { speed: 70, life: 1.1, size: 9 });
    w.particles.emit('ember', this.centerX, this.centerY, 26, { speed: 200, life: 1.2, size: 3 });
    w.particles.emit('shard', this.centerX, this.centerY, 10, { speed: 220, life: 0.9, size: 4 });
  }

  update(dt: number, player: Player, solids: readonly SolidDef[], w: WorldServices) {
    this.animTime += dt;
    this.stateTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);

    if (this.dead) {
      this.deathTimer -= dt;
      this.body.vx *= 1 - Math.min(1, 8 * dt);
      this.body.vy = Math.min(PHYSICS.MAX_FALL, this.body.vy + PHYSICS.GRAVITY * dt);
      moveBody(this.body, dt, solids);
      if (this.deathTimer <= 0) this.removeMe = true;
      return;
    }

    if (this.state === 'stagger') {
      this.staggerTime -= dt;
      this.body.vx *= 1 - Math.min(1, 6 * dt);
      if (this.staggerTime <= 0) this.setState('chase');
    } else {
      this.think(dt, player, solids, w);
    }

    this.body.vy = Math.min(PHYSICS.MAX_FALL, this.body.vy + PHYSICS.GRAVITY * dt);
    moveBody(this.body, dt, solids);
  }

  /** shared helper: walk toward direction respecting ledges & walls */
  protected walk(dir: Facing, speed: number, solids: readonly SolidDef[], respectLedges = true): boolean {
    if (respectLedges && this.body.grounded && !groundAhead(this.body, dir, solids, 24)) {
      this.body.vx = 0;
      return false;
    }
    if (wallAhead(this.body, dir, solids)) {
      this.body.vx = 0;
      return false;
    }
    this.body.vx = dir * speed;
    this.facing = dir;
    return true;
  }
}

// ============================================================ ASH GRUNT
export class AshGrunt extends Enemy {
  readonly kind = 'ash_grunt' as const;
  private cfg = ENEMY.ASH_GRUNT;
  private patrolPause = 0;

  constructor(def: EnemySpawnDef) {
    const c = ENEMY.ASH_GRUNT;
    super(def, c.WIDTH, c.HEIGHT, c.HP, c.COIN_DROP, c.ESSENCE_DROP);
    this.knockback = c.KNOCKBACK;
  }

  protected staggerDuration() {
    return this.cfg.STAGGER;
  }
  contactDamage() {
    return 0;
  }

  attackHitbox(): Rect | null {
    if (this.state !== 'attack') return null;
    const r = this.cfg.ATTACK_RANGE + 14;
    return { x: this.facing > 0 ? this.body.x + this.body.w - 6 : this.body.x - r + 6, y: this.body.y + 6, w: r, h: this.body.h - 10 };
  }

  /** windup progress 0..1 for telegraph rendering */
  get windupProgress() {
    return this.state === 'windup' ? Math.min(1, this.stateTime / this.cfg.ATTACK_WINDUP) : 0;
  }

  protected think(dt: number, player: Player, solids: readonly SolidDef[], w: WorldServices) {
    const c = this.cfg;
    const dx = player.centerX - this.centerX;
    const dist = Math.abs(dx);
    const dy = Math.abs(player.centerY - this.centerY);
    const seesPlayer = !player.dead && dist < c.DETECT_RANGE && dy < 90;

    switch (this.state) {
      case 'patrol': {
        if (seesPlayer) {
          this.setState('alert');
          w.audio.play('enemy_alert');
          w.particles.emit('ember', this.centerX, this.body.y - 6, 4, { speed: 40, life: 0.5 });
          break;
        }
        if (this.patrolPause > 0) {
          this.patrolPause -= dt;
          this.body.vx = 0;
          break;
        }
        if (this.centerX <= this.patrolMin) this.facing = 1;
        if (this.centerX >= this.patrolMax) this.facing = -1;
        if (!this.walk(this.facing, c.SPEED_PATROL, solids)) {
          this.facing = (-this.facing) as Facing;
          this.patrolPause = 0.8 + Math.random() * 0.8;
        }
        break;
      }
      case 'alert':
        this.body.vx = 0;
        this.facing = dx > 0 ? 1 : -1;
        if (this.stateTime > 0.35) this.setState('chase');
        break;
      case 'chase': {
        if (player.dead || dist > c.LOSE_RANGE) {
          this.setState('patrol');
          break;
        }
        if (dist < c.ATTACK_RANGE && dy < 60) {
          this.body.vx = 0;
          this.setState('windup');
          break;
        }
        const dir: Facing = dx > 0 ? 1 : -1;
        if (!this.walk(dir, c.SPEED_CHASE, solids)) {
          this.facing = dir;
        }
        break;
      }
      case 'windup':
        this.body.vx *= 1 - Math.min(1, 10 * dt);
        if (this.stateTime >= c.ATTACK_WINDUP) {
          this.setState('attack');
          w.audio.play('swing');
          this.body.vx = this.facing * 140;
        }
        break;
      case 'attack':
        if (this.stateTime >= c.ATTACK_ACTIVE) this.setState('recover');
        break;
      case 'recover':
        this.body.vx *= 1 - Math.min(1, 8 * dt);
        if (this.stateTime >= c.ATTACK_RECOVER) this.setState('chase');
        break;
      default:
        break;
    }
  }
}

// ============================================================ ASH BEAST
export class AshBeast extends Enemy {
  readonly kind = 'ash_beast' as const;
  private cfg = ENEMY.ASH_BEAST;

  constructor(def: EnemySpawnDef) {
    const c = ENEMY.ASH_BEAST;
    super(def, c.WIDTH, c.HEIGHT, c.HP, c.COIN_DROP, c.ESSENCE_DROP);
    this.knockback = c.KNOCKBACK;
  }

  protected staggerDuration() {
    return this.cfg.STAGGER;
  }
  contactDamage() {
    return this.state === 'attack' ? this.cfg.ATTACK_DAMAGE : 0;
  }
  attackHitbox(): Rect | null {
    if (this.state !== 'attack') return null;
    return { x: this.body.x - 4, y: this.body.y, w: this.body.w + 8, h: this.body.h };
  }
  get windupProgress() {
    return this.state === 'windup' ? Math.min(1, this.stateTime / this.cfg.CHARGE_WINDUP) : 0;
  }

  protected think(dt: number, player: Player, solids: readonly SolidDef[], w: WorldServices) {
    const c = this.cfg;
    const dx = player.centerX - this.centerX;
    const dist = Math.abs(dx);
    const dy = Math.abs(player.centerY - this.centerY);
    const sees = !player.dead && dist < c.DETECT_RANGE && dy < 80;

    switch (this.state) {
      case 'patrol':
        if (sees) {
          this.setState('alert');
          w.audio.play('beast_roar');
          break;
        }
        if (this.centerX <= this.patrolMin) this.facing = 1;
        if (this.centerX >= this.patrolMax) this.facing = -1;
        if (!this.walk(this.facing, c.SPEED_PATROL, solids)) this.facing = (-this.facing) as Facing;
        break;
      case 'alert':
        this.body.vx = 0;
        this.facing = dx > 0 ? 1 : -1;
        if (this.stateTime > 0.3) this.setState('windup');
        break;
      case 'chase': {
        if (player.dead || dist > c.DETECT_RANGE * 1.5) {
          this.setState('patrol');
          break;
        }
        this.facing = dx > 0 ? 1 : -1;
        this.body.vx = 0;
        if (this.stateTime > 0.4) this.setState('windup');
        break;
      }
      case 'windup':
        this.body.vx *= 1 - Math.min(1, 10 * dt);
        this.facing = dx > 0 ? 1 : -1;
        if (this.stateTime % 0.1 < dt) w.particles.emit('dust', this.centerX - this.facing * 20, this.body.y + this.body.h, 2, { speed: 50, life: 0.4, size: 4 });
        if (this.stateTime >= c.CHARGE_WINDUP) {
          this.setState('attack');
          w.audio.play('dash');
        }
        break;
      case 'attack': {
        const moved = this.walk(this.facing, c.SPEED_CHARGE, solids, true);
        w.particles.emit('dust', this.centerX - this.facing * 24, this.body.y + this.body.h, 1, { speed: 60, life: 0.4, size: 5 });
        w.particles.emit('ember', this.centerX, this.centerY, 1, { speed: 60, life: 0.5 });
        if (!moved || this.stateTime >= c.CHARGE_DURATION) {
          this.setState('recover');
          if (!moved) {
            w.camera.shake(3);
            w.particles.emit('dust', this.centerX + this.facing * 20, this.centerY, 10, { speed: 100, life: 0.5, size: 5 });
          }
        }
        break;
      }
      case 'recover':
        this.body.vx *= 1 - Math.min(1, 6 * dt);
        if (this.stateTime >= c.CHARGE_RECOVER) this.setState('chase');
        break;
      default:
        break;
    }
  }
}

export function createEnemy(def: EnemySpawnDef): Enemy {
  switch (def.kind) {
    case 'ash_beast':
      return new AshBeast(def);
    case 'ash_grunt':
    default:
      return new AshGrunt(def);
  }
}

export function enemyOverlapsRect(e: Enemy, r: Rect) {
  return overlaps(e.body, r);
}
