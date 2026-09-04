import { FEEL, PHYSICS, PLAYER } from './config';
import type { InputSystem } from './input';
import { moveBody, type Body } from './physics';
import type { Facing, PlayerAnim, PlayerStats, Rect, SolidDef } from './types';
import type { WorldServices } from './world';

/**
 * The Flamebearer. Owns movement, combat state and animation state.
 * Rendering is done by the character rig (renderer/characterRig.ts) using
 * the public animation fields exposed here.
 */
export class Player {
  body: Body = { x: 0, y: 0, w: PLAYER.WIDTH, h: PLAYER.HEIGHT, vx: 0, vy: 0, grounded: false, wallDir: 0, hitCeiling: false };
  facing: Facing = 1;
  hp: number;
  flame: number;
  stats: PlayerStats;

  anim: PlayerAnim = 'idle';
  animTime = 0;
  /** normalized progress of the current attack 0..1 */
  attackProgress = 0;
  attackIndex = 0;
  dead = false;
  invuln = 0;
  dashCooldown = 0;
  specialCooldown = 0;
  landSquash = 0;
  runCycle = 0;
  idleTime = 0;

  private attackTimer = 0;
  private attackDuration = 0;
  private comboWindow = 0;
  private attackBuffer = 0;
  private jumpBuffer = 0;
  private coyote = 0;
  private dashTimer = 0;
  private hurtTimer = 0;
  private interactTimer = 0;
  private deathTimer = 0;
  private landTimer = 0;
  private canDoubleJump = false;
  private wasGrounded = false;
  private prevVy = 0;
  private footstepTimer = 0;
  private hitThisSwing = new Set<object>();
  private dashDir: Facing = 1;
  private specialTimer = 0;

  constructor(stats: PlayerStats) {
    this.stats = stats;
    this.hp = stats.maxHp;
    this.flame = Math.round(stats.maxFlame * 0.6);
  }

  spawnAt(x: number, y: number) {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.dead = false;
    this.anim = 'idle';
    this.animTime = 0;
    this.hurtTimer = 0;
    this.attackTimer = 0;
    this.dashTimer = 0;
    this.invuln = 1.0;
    this.facing = 1;
  }

  restore() {
    this.hp = this.stats.maxHp;
    this.flame = Math.max(this.flame, Math.round(this.stats.maxFlame * 0.6));
  }

  get rect(): Rect {
    return this.body;
  }
  get centerX() {
    return this.body.x + this.body.w / 2;
  }
  get centerY() {
    return this.body.y + this.body.h / 2;
  }
  get isDashing() {
    return this.dashTimer > 0;
  }
  get isAttacking() {
    return this.attackTimer > 0;
  }
  get isBusy() {
    return this.dead || this.hurtTimer > 0 || this.interactTimer > 0 || this.specialTimer > 0;
  }

  /** World-space hitbox for the current swing, or null if inactive. */
  attackHitbox(): Rect | null {
    if (this.attackTimer <= 0) return null;
    const elapsed = this.attackDuration - this.attackTimer;
    if (elapsed < PLAYER.ATTACK_ACTIVE_START || elapsed > PLAYER.ATTACK_ACTIVE_END + (this.attackIndex === 2 ? 0.08 : 0)) return null;
    const range = PLAYER.ATTACK_RANGE * (this.attackIndex === 2 ? 1.25 : 1);
    return {
      x: this.facing > 0 ? this.body.x + this.body.w - 8 : this.body.x - range + 8,
      y: this.body.y + (this.body.h - PLAYER.ATTACK_HEIGHT) / 2 - 4,
      w: range,
      h: PLAYER.ATTACK_HEIGHT + 8,
    };
  }

  alreadyHit(target: object) {
    return this.hitThisSwing.has(target);
  }
  markHit(target: object) {
    this.hitThisSwing.add(target);
  }
  currentDamage() {
    return Math.round(PLAYER.ATTACK_DAMAGE[this.attackIndex] * this.stats.attackMult);
  }

  /** Special attack active radius, or null. */
  specialBurst(): { x: number; y: number; r: number } | null {
    if (this.specialTimer <= 0) return null;
    const elapsed = 0.5 - this.specialTimer;
    if (elapsed < 0.12 || elapsed > 0.2) return null;
    return { x: this.centerX, y: this.centerY, r: PLAYER.SPECIAL_RADIUS };
  }

  spendFlame(amount: number): boolean {
    if (this.flame < amount) return false;
    this.flame -= amount;
    return true;
  }
  addFlame(amount: number) {
    this.flame = Math.min(this.stats.maxFlame, this.flame + amount);
  }
  heal(amount: number) {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
  }

  playInteract() {
    this.interactTimer = 0.55;
    this.anim = 'interact';
    this.animTime = 0;
    this.body.vx = 0;
  }

  playVictory() {
    this.anim = 'victory';
    this.animTime = 0;
    this.body.vx = 0;
    this.interactTimer = 99;
  }

  /** Apply damage. Returns true if damage was applied. */
  takeDamage(amount: number, fromX: number, w: WorldServices): boolean {
    if (this.dead || this.invuln > 0 || this.dashTimer > 0) return false;
    const dmg = Math.max(1, Math.round(amount * this.stats.damageTakenMult));
    this.hp -= dmg;
    this.attackTimer = 0;
    this.specialTimer = 0;
    this.interactTimer = 0;
    const dir: Facing = fromX < this.centerX ? 1 : -1;
    this.body.vx = dir * PLAYER.HURT_KNOCKBACK_X;
    this.body.vy = -PLAYER.HURT_KNOCKBACK_Y;
    this.body.grounded = false;
    w.particles.emit('spark', this.centerX, this.centerY, 8, { speed: 220, color: '#ffb0a0', life: 0.35, size: 2.5 });
    w.particles.emit('ember', this.centerX, this.centerY, 6, { speed: 120, life: 0.6 });
    w.camera.shake(FEEL.SHAKE_HEAVY);
    w.requestHitStop(FEEL.HIT_STOP_HEAVY);
    w.emit({ type: 'hitflash' });
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(w);
    } else {
      this.hurtTimer = PLAYER.HURT_DURATION;
      this.invuln = PLAYER.INVULN_AFTER_HIT;
      this.anim = 'hurt';
      this.animTime = 0;
      w.audio.play('hurt');
    }
    return true;
  }

  die(w: WorldServices) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.anim = 'dead';
    this.animTime = 0;
    this.deathTimer = PLAYER.RESPAWN_DELAY;
    this.body.vx *= 0.3;
    w.audio.play('death');
    w.camera.shake(FEEL.SHAKE_HEAVY * 1.5);
    w.particles.emit('flame', this.centerX, this.centerY, 30, { speed: 200, life: 0.9, size: 5 });
    w.particles.emit('ember', this.centerX, this.centerY, 40, { speed: 260, life: 1.6, size: 3 });
    w.particles.emit('smoke', this.centerX, this.centerY, 14, { speed: 60, life: 1.4, size: 10 });
  }

  /** Returns true once the death timer has elapsed. */
  deathElapsed(dt: number): boolean {
    if (!this.dead) return false;
    this.deathTimer -= dt;
    return this.deathTimer <= 0;
  }

  // ------------------------------------------------------------------ update
  update(dt: number, input: InputSystem, solids: readonly SolidDef[], w: WorldServices) {
    const b = this.body;
    this.animTime += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.landSquash = Math.max(0, this.landSquash - dt * 5);
    this.flame = Math.min(this.stats.maxFlame, this.flame + PLAYER.FLAME_REGEN_PER_SEC * this.stats.flameRegenMult * dt);

    if (this.dead) {
      b.vy = Math.min(PHYSICS.MAX_FALL, b.vy + PHYSICS.GRAVITY * dt);
      b.vx *= 1 - Math.min(1, 6 * dt);
      moveBody(b, dt, solids);
      return;
    }

    if (this.interactTimer > 0) {
      this.interactTimer -= dt;
      b.vx = 0;
      b.vy = Math.min(PHYSICS.MAX_FALL, b.vy + PHYSICS.GRAVITY * dt);
      moveBody(b, dt, solids);
      if (this.interactTimer <= 0 && this.anim !== 'victory') this.anim = 'idle';
      return;
    }

    // buffers
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    if (input.pressed('jump')) this.jumpBuffer = PLAYER.JUMP_BUFFER;
    if (input.pressed('attack')) this.attackBuffer = PLAYER.ATTACK_BUFFER;

    const axis = input.axis();
    const speedMax = PLAYER.RUN_SPEED * this.stats.moveMult;

    // --- hurt
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      b.vy = Math.min(PHYSICS.MAX_FALL, b.vy + PHYSICS.GRAVITY * dt);
      b.vx *= 1 - Math.min(1, 4 * dt);
      moveBody(b, dt, solids);
      if (this.hurtTimer <= 0) this.anim = b.grounded ? 'idle' : 'fall';
      return;
    }

    // --- special
    if (this.specialTimer > 0) {
      this.specialTimer -= dt;
      b.vx *= 1 - Math.min(1, 10 * dt);
      b.vy = Math.min(PHYSICS.MAX_FALL, b.vy + PHYSICS.GRAVITY * dt * 0.4);
      moveBody(b, dt, solids);
      if (this.specialTimer <= 0) this.anim = 'idle';
      return;
    }

    // --- dash
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      b.vx = this.dashDir * PLAYER.DASH_SPEED;
      b.vy = 0;
      moveBody(b, dt, solids);
      if (Math.random() < 0.9) {
        w.particles.emit('flame', this.centerX - this.dashDir * 10, this.centerY + 6, 2, { speed: 30, life: 0.3, size: 5, vx: -this.dashDir * 80 });
        w.particles.emit('dust', this.centerX, b.y + b.h, 1, { speed: 40, life: 0.4, size: 4 });
      }
      if (this.dashTimer <= 0) {
        b.vx = this.dashDir * speedMax * 0.7;
        this.anim = b.grounded ? 'run' : 'fall';
      }
      return;
    }

    // --- start dash
    if (input.pressed('dash') && this.dashCooldown <= 0) {
      this.startDash(axis !== 0 ? (Math.sign(axis) as Facing) : this.facing, w);
      return;
    }

    // --- special
    if (
      input.pressed('special') &&
      this.stats.specialUnlocked &&
      this.specialCooldown <= 0 &&
      this.attackTimer <= 0 &&
      this.flame >= PLAYER.SPECIAL_COST
    ) {
      this.flame -= PLAYER.SPECIAL_COST;
      this.specialTimer = 0.5;
      this.specialCooldown = PLAYER.SPECIAL_COOLDOWN;
      this.anim = 'special';
      this.animTime = 0;
      w.audio.play('special');
      w.camera.shake(FEEL.SHAKE_HEAVY);
      w.particles.emit('flame', this.centerX, this.centerY, 40, { speed: 320, life: 0.6, size: 7 });
      w.particles.emit('ember', this.centerX, this.centerY, 40, { speed: 380, life: 1.1, size: 3 });
      w.particles.emit('spark', this.centerX, this.centerY, 20, { speed: 400, life: 0.4 });
      return;
    }

    // --- attack
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
      this.attackProgress = 1 - this.attackTimer / this.attackDuration;
      // lunge
      const lunge = this.attackProgress < 0.4 ? PLAYER.ATTACK_LUNGE * (this.attackIndex === 2 ? 1.5 : 1) : 0;
      if (b.grounded) b.vx = this.facing * lunge;
      else b.vx *= 1 - Math.min(1, 2 * dt);
      b.vy = Math.min(PHYSICS.MAX_FALL, b.vy + PHYSICS.GRAVITY * dt * (b.grounded ? 1 : 0.55));
      moveBody(b, dt, solids);
      // combo chaining
      if (this.attackTimer <= 0) {
        this.comboWindow = PLAYER.ATTACK_COMBO_WINDOW;
        this.anim = b.grounded ? 'idle' : 'fall';
      } else if (this.attackProgress > 0.62 && this.attackBuffer > 0 && this.attackIndex < 2) {
        this.startAttack(this.attackIndex + 1, w);
      }
      return;
    }

    if (this.attackBuffer > 0) {
      const next = this.comboWindow > 0 ? Math.min(2, this.attackIndex + 1) : 0;
      this.startAttack(next, w);
      return;
    }

    // --- horizontal movement
    if (axis !== 0) {
      const accel = b.grounded ? PLAYER.ACCEL_GROUND : PLAYER.ACCEL_AIR;
      const cap = speedMax * Math.min(1, Math.abs(axis));
      const before = Math.abs(b.vx);
      b.vx += axis * accel * dt;
      if (Math.abs(b.vx) > cap) {
        // above cap (e.g. exiting a dash): bleed speed down to the cap instead of snapping
        const mag = before > cap ? Math.max(cap, before - PLAYER.FRICTION_GROUND * dt) : cap;
        b.vx = Math.sign(b.vx) * mag;
      }
      this.facing = axis > 0 ? 1 : -1;
    } else {
      const fr = b.grounded ? PLAYER.FRICTION_GROUND : PLAYER.FRICTION_AIR;
      if (Math.abs(b.vx) <= fr * dt) b.vx = 0;
      else b.vx -= Math.sign(b.vx) * fr * dt;
    }

    // --- jumping
    if (b.grounded) {
      this.coyote = PLAYER.COYOTE_TIME;
      this.canDoubleJump = this.stats.doubleJump;
    } else this.coyote = Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0) {
      if (this.coyote > 0) {
        this.jump(PLAYER.JUMP_VELOCITY, w, false);
      } else if (this.canDoubleJump) {
        this.canDoubleJump = false;
        this.jump(PLAYER.DOUBLE_JUMP_VELOCITY, w, true);
      }
    }
    if (input.released('jump') && b.vy < 0) b.vy *= PLAYER.JUMP_CUT_MULT;

    // --- gravity
    const fast = input.isDown('interact') && !b.grounded && b.vy > 0 ? PHYSICS.FAST_FALL_MULT : 1;
    b.vy = Math.min(PHYSICS.MAX_FALL * fast, b.vy + PHYSICS.GRAVITY * fast * dt);

    const dropThrough = input.isDown('interact') && input.pressed('jump');
    this.prevVy = b.vy;
    moveBody(b, dt, solids, dropThrough);

    // --- landing
    if (b.grounded && !this.wasGrounded) {
      const impact = Math.min(1, this.prevVy / PHYSICS.MAX_FALL);
      this.landSquash = 0.35 + impact * 0.5;
      this.landTimer = 0.1;
      w.audio.play('land');
      w.particles.emit('dust', this.centerX, b.y + b.h, 5 + Math.round(impact * 8), { speed: 60 + impact * 60, life: 0.45, size: 4, arc: Math.PI, dir: -Math.PI / 2 });
      if (impact > 0.6) w.camera.shake(FEEL.SHAKE_LAND);
    }
    this.wasGrounded = b.grounded;
    this.landTimer = Math.max(0, this.landTimer - dt);

    // --- anim selection
    if (!b.grounded) this.anim = b.vy < -60 ? 'jump' : 'fall';
    else if (this.landTimer > 0) this.anim = 'land';
    else if (Math.abs(b.vx) > 20) this.anim = 'run';
    else this.anim = 'idle';

    if (this.anim === 'run') {
      this.runCycle += dt * (Math.abs(b.vx) / speedMax) * 11;
      this.footstepTimer -= dt * (Math.abs(b.vx) / speedMax);
      if (this.footstepTimer <= 0) {
        this.footstepTimer = 0.28;
        w.audio.play('footstep');
        w.particles.emit('dust', this.centerX - this.facing * 8, b.y + b.h, 1, { speed: 25, life: 0.35, size: 3 });
      }
    } else this.footstepTimer = 0.05;

    this.idleTime = this.anim === 'idle' ? this.idleTime + dt : 0;
  }

  private jump(v: number, w: WorldServices, isDouble: boolean) {
    this.body.vy = -v;
    this.body.grounded = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.anim = 'jump';
    this.animTime = 0;
    w.audio.play(isDouble ? 'double_jump' : 'jump');
    if (isDouble) {
      w.particles.emit('flame', this.centerX, this.body.y + this.body.h - 6, 12, { speed: 120, life: 0.4, size: 5, arc: Math.PI, dir: Math.PI / 2 });
    } else {
      w.particles.emit('dust', this.centerX, this.body.y + this.body.h, 6, { speed: 60, life: 0.4, size: 3, arc: Math.PI, dir: -Math.PI / 2 });
    }
  }

  private startDash(dir: Facing, w: WorldServices) {
    this.dashDir = dir;
    this.facing = dir;
    this.dashTimer = PLAYER.DASH_DURATION;
    this.dashCooldown = PLAYER.DASH_COOLDOWN * this.stats.dashCooldownMult;
    this.invuln = Math.max(this.invuln, PLAYER.DASH_INVULN);
    this.attackTimer = 0;
    this.anim = 'dash';
    this.animTime = 0;
    w.audio.play('dash');
    w.particles.emit('flame', this.centerX, this.centerY, 10, { speed: 90, life: 0.35, size: 6, vx: -dir * 120 });
  }

  private startAttack(index: number, w: WorldServices) {
    this.attackIndex = index;
    this.attackDuration = PLAYER.ATTACK_DURATION[index];
    this.attackTimer = this.attackDuration;
    this.attackProgress = 0;
    this.attackBuffer = 0;
    this.comboWindow = 0;
    this.hitThisSwing.clear();
    this.anim = (['attack1', 'attack2', 'attack3'] as const)[index];
    this.animTime = 0;
    w.audio.play('swing');
    const fx = this.centerX + this.facing * 26;
    w.particles.emit('flame', fx, this.centerY, index === 2 ? 10 : 5, { speed: 90, life: 0.3, size: 4, vx: this.facing * 120 });
  }

  /** Called by the world when a swing connects. */
  onHitConfirm(w: WorldServices, heavy: boolean) {
    w.requestHitStop(heavy ? FEEL.HIT_STOP_HEAVY : FEEL.HIT_STOP);
    w.camera.shake(heavy ? FEEL.SHAKE_HEAVY : FEEL.SHAKE_HIT);
    this.addFlame(heavy ? 6 : 3);
  }
}
