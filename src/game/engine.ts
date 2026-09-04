import { AudioSystem } from './audio';
import { Camera } from './camera';
import { COLLECT, LOOP, PALETTE, PARTICLES, PLAYER, VIEW } from './config';
import { createEnemy, type Enemy } from './enemies';
import { InputSystem, type Action } from './input';
import { ParticleSystem } from './particles';
import { overlaps } from './physics';
import { Player } from './player';
import { ForestEnvironment } from './render/environment';
import { drawEnemy, drawPlayer } from './render/rigs';
import type {
  CheckpointSnapshot,
  CollectibleKind,
  HudSnapshot,
  LevelDef,
  LevelResult,
  PlayerStats,
  RuntimeListener,
  SolidDef,
} from './types';
import { VIEW_MAX_W, VIEW_MIN_W, viewport } from './viewport';
import type { WorldServices } from './world';

export interface RuntimeOptions {
  level: LevelDef;
  stats: PlayerStats;
  /** resume from a saved checkpoint id (optional) */
  checkpointId?: string | null;
  settings: {
    musicVolume: number;
    sfxVolume: number;
    reducedShake: boolean;
    showHitFlash: boolean;
  };
  onEvent: RuntimeListener;
}

interface CollectibleEntity {
  kind: CollectibleKind;
  x: number;
  y: number;
  ox: number;
  oy: number;
  taken: boolean;
  magnet: boolean;
}
interface CheckpointEntity {
  id: string;
  x: number;
  y: number;
  active: boolean;
  activeTime: number;
}
interface AltarEntity {
  id: string;
  x: number;
  y: number;
  lit: boolean;
  litTime: number;
  opens?: string;
  flameCost: number;
}
interface GateEntity {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  open: boolean;
  progress: number;
}

const TUTORIAL_HINTS: { x: number; text: string }[] = [
  { x: 40, text: 'Move with the left control · Jump to cross the pit ahead' },
  { x: 820, text: 'Attack to strike · Chain three hits for a heavy finisher' },
  { x: 1180, text: 'Dash through danger — you are untouchable while dashing' },
  { x: 2520, text: 'The gate is sealed. Ignite the altar with your flame' },
];

/**
 * GameRuntime — owns the loop, world state and rendering. React talks to it
 * through a small imperative API and receives coarse events. No React state
 * is touched per frame.
 */
export class GameRuntime {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lightCanvas: HTMLCanvasElement;
  private lightCtx: CanvasRenderingContext2D;
  private container: HTMLElement;

  readonly input = new InputSystem();
  readonly audio = new AudioSystem();
  readonly particles = new ParticleSystem();
  readonly camera = new Camera();
  private env: ForestEnvironment;

  private level: LevelDef;
  private player: Player;
  private enemies: Enemy[] = [];
  private collectibles: CollectibleEntity[] = [];
  private checkpoints: CheckpointEntity[] = [];
  private altars: AltarEntity[] = [];
  private gates: GateEntity[] = [];
  private solids: SolidDef[] = [];
  private hintsShown = new Set<number>();

  private running = false;
  private paused = false;
  private destroyed = false;
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private hitStop = 0;
  private time = 0;
  private levelTime = 0;
  private deaths = 0;
  private enemiesDefeated = 0;
  private coins = 0;
  private essence = 0;
  private coinsAtCheckpoint = 0;
  private essenceAtCheckpoint = 0;
  private respawnPoint: { x: number; y: number };
  private activeCheckpointId: string | null = null;
  private victory = false;
  private victoryTimer = 0;
  private deathReported = false;
  private hudTimer = 0;
  private lastHud: HudSnapshot | null = null;
  private world: WorldServices;
  private settings: RuntimeOptions['settings'];
  private onEvent: RuntimeListener;
  private resizeObserver: ResizeObserver | null = null;
  private ambientTimer = 0;
  private nearAltar: AltarEntity | null = null;
  private exitReached = false;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement, opts: RuntimeOptions) {
    this.canvas = canvas;
    this.container = container;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d')!;

    this.level = opts.level;
    this.settings = opts.settings;
    this.onEvent = opts.onEvent;
    this.env = new ForestEnvironment(this.level);
    this.player = new Player(opts.stats);

    this.world = {
      particles: this.particles,
      audio: this.audio,
      camera: this.camera,
      requestHitStop: (s) => (this.hitStop = Math.max(this.hitStop, s)),
      emit: (e) => this.onEvent(e),
      time: 0,
    };

    this.camera.levelWidth = this.level.width;
    this.camera.levelHeight = this.level.height;
    this.camera.setReducedShake(opts.settings.reducedShake);
    this.audio.setVolumes(opts.settings.musicVolume, opts.settings.sfxVolume);

    this.respawnPoint = { ...this.level.spawn };
    this.buildLevel();

    if (opts.checkpointId) {
      const cp = this.checkpoints.find((c) => c.id === opts.checkpointId);
      if (cp) {
        cp.active = true;
        cp.activeTime = 10;
        this.activeCheckpointId = cp.id;
        this.respawnPoint = { x: cp.x - PLAYER.WIDTH / 2, y: cp.y - PLAYER.HEIGHT };
        // altars before the checkpoint are considered solved
        for (const a of this.altars) if (a.x < cp.x) this.lightAltar(a, true);
        for (const h of TUTORIAL_HINTS.keys()) if (TUTORIAL_HINTS[h].x < cp.x) this.hintsShown.add(h);
      }
    }

    this.player.spawnAt(this.respawnPoint.x, this.respawnPoint.y);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this.seedAmbient();

    this.handleResize();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.input.attach();
  }

  /* ------------------------------------------------------------ setup */
  private buildLevel() {
    const L = this.level;
    this.enemies = L.enemies.map(createEnemy);
    this.collectibles = L.collectibles.map((c) => ({ kind: c.kind, x: c.x, y: c.y, ox: c.x, oy: c.y, taken: false, magnet: false }));
    this.checkpoints = L.checkpoints.map((c) => ({ ...c, active: false, activeTime: 0 }));
    this.altars = L.interactables
      .filter((i) => i.kind === 'flame_altar')
      .map((i) => ({ id: i.id, x: i.x, y: i.y, lit: false, litTime: 0, opens: i.opens, flameCost: i.flameCost ?? 20 }));
    this.gates = L.gates.map((g) => ({ ...g, open: false, progress: 0 }));
    this.rebuildSolids();
  }

  private rebuildSolids() {
    this.solids = [...this.level.solids];
    for (const g of this.gates) if (!g.open) this.solids.push({ x: g.x, y: g.y, w: g.w, h: g.h, kind: 'stone' });
  }

  private seedAmbient() {
    for (let i = 0; i < PARTICLES.AMBIENT_ASH_COUNT; i++) {
      this.particles.emit('ash', this.camera.x + Math.random() * viewport.w, this.camera.y + Math.random() * viewport.h, 1, {
        speed: 18,
        life: 8,
        size: 1.6,
        dir: Math.PI * 0.6,
        arc: 0.6,
      });
    }
  }

  private handleResize() {
    const cw = this.container.clientWidth || VIEW.WIDTH;
    const ch = this.container.clientHeight || VIEW.HEIGHT;
    const aspect = cw / ch;
    viewport.h = VIEW.HEIGHT;
    viewport.w = Math.round(Math.max(VIEW_MIN_W, Math.min(VIEW_MAX_W, VIEW.HEIGHT * aspect)));
    const scale = Math.min(cw / viewport.w, ch / viewport.h);
    const dpr = Math.min(VIEW.MAX_DPR, window.devicePixelRatio || 1);
    viewport.scale = scale;
    viewport.dpr = dpr;
    this.canvas.width = Math.round(viewport.w * dpr);
    this.canvas.height = Math.round(viewport.h * dpr);
    this.canvas.style.width = `${Math.round(viewport.w * scale)}px`;
    this.canvas.style.height = `${Math.round(viewport.h * scale)}px`;
    this.lightCanvas.width = Math.round(viewport.w / 2);
    this.lightCanvas.height = Math.round(viewport.h / 2);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    if (!this.running) this.render();
  }

  private onVisibility = () => {
    if (document.hidden) {
      this.pause();
      this.audio.suspend();
    } else {
      this.audio.resume();
    }
  };

  /* ------------------------------------------------------------ public API */
  start() {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.paused = false;
    this.audio.unlock();
    this.audio.startMusic('explore');
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.input.clearAll();
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.audio.unlock();
    this.lastTime = performance.now();
  }

  get isPaused() {
    return this.paused;
  }

  setVirtual(action: Action, active: boolean) {
    this.input.setVirtual(action, active);
  }
  setVirtualAxis(v: number) {
    this.input.setVirtualAxis(v);
  }

  updateSettings(s: Partial<RuntimeOptions['settings']>) {
    this.settings = { ...this.settings, ...s };
    this.audio.setVolumes(this.settings.musicVolume, this.settings.sfxVolume);
    this.camera.setReducedShake(this.settings.reducedShake);
  }

  /** Respawn at the last checkpoint after death. */
  respawn() {
    this.deathReported = false;
    this.coins = this.coinsAtCheckpoint;
    this.essence = this.essenceAtCheckpoint;
    // restore collectibles taken since last checkpoint? Keep design simple: keep taken state
    for (const e of this.enemies) if (!e.dead && Math.abs(e.centerX - this.respawnPoint.x) < 500) e.state = 'patrol';
    this.player.spawnAt(this.respawnPoint.x, this.respawnPoint.y);
    this.player.restore();
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this.particles.emit('flame', this.player.centerX, this.player.centerY, 30, { speed: 150, life: 0.7, size: 5 });
    this.audio.play('checkpoint');
    this.onEvent({ type: 'respawn' });
    this.resume();
  }

  /** Full level restart. */
  restart() {
    this.deaths = 0;
    this.enemiesDefeated = 0;
    this.coins = 0;
    this.essence = 0;
    this.coinsAtCheckpoint = 0;
    this.essenceAtCheckpoint = 0;
    this.levelTime = 0;
    this.victory = false;
    this.exitReached = false;
    this.deathReported = false;
    this.hintsShown.clear();
    this.activeCheckpointId = null;
    this.respawnPoint = { ...this.level.spawn };
    this.buildLevel();
    this.particles.clear();
    this.player = new Player(this.player.stats);
    this.player.spawnAt(this.respawnPoint.x, this.respawnPoint.y);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this.seedAmbient();
    this.onEvent({ type: 'respawn' });
    this.resume();
  }

  destroy() {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.destroy();
  }

  /* ------------------------------------------------------------ loop */
  private frame = (now: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > LOOP.MAX_FRAME_DT) dt = LOOP.MAX_FRAME_DT;

    if (!this.paused) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= LOOP.FIXED_DT && steps < LOOP.MAX_SUBSTEPS) {
        this.step(LOOP.FIXED_DT);
        this.accumulator -= LOOP.FIXED_DT;
        steps++;
      }
      if (steps === LOOP.MAX_SUBSTEPS) this.accumulator = 0;
    }
    this.render();
  };

  private step(dt: number) {
    this.input.poll();
    if (this.input.pressed('pause')) {
      this.onEvent({ type: 'toast', text: '__pause__' });
      return;
    }

    this.time += dt;
    this.world.time = this.time;

    // hit-stop freezes gameplay but keeps particles/camera alive
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.particles.update(dt * 0.3);
      this.camera.update(dt, this.player.centerX, this.player.centerY, this.player.facing, this.player.body.grounded);
      return;
    }

    if (!this.player.dead && !this.victory) this.levelTime += dt;

    // --- player
    const p = this.player;
    p.update(dt, this.input, this.solids, this.world);

    // --- interact (altar)
    this.nearAltar = null;
    for (const a of this.altars) {
      if (a.lit) {
        a.litTime += dt;
        continue;
      }
      if (Math.abs(p.centerX - a.x) < 56 && Math.abs(p.body.y + p.body.h - a.y) < 40) this.nearAltar = a;
    }
    if (this.nearAltar && this.input.pressed('interact') && !p.isBusy) {
      if (p.spendFlame(this.nearAltar.flameCost)) {
        p.playInteract();
        this.lightAltar(this.nearAltar, false);
      } else {
        this.onEvent({ type: 'toast', text: 'Not enough Ash Flame — strike enemies to gather more' });
      }
    }

    // --- gates animate
    for (const g of this.gates) {
      if (g.open && g.progress < 1) {
        g.progress = Math.min(1, g.progress + dt * 0.8);
        if (Math.random() < 0.5) this.particles.emit('dust', g.x + g.w / 2, g.y + g.h - g.progress * g.h, 1, { speed: 30, life: 0.5, size: 3 });
      }
    }

    // --- checkpoints
    for (const c of this.checkpoints) {
      if (c.active) {
        c.activeTime += dt;
        continue;
      }
      if (Math.abs(p.centerX - c.x) < 40 && Math.abs(p.body.y + p.body.h - c.y) < 30 && !p.dead) this.activateCheckpoint(c);
    }

    // --- enemies
    for (const e of this.enemies) {
      if (e.removeMe) continue;
      e.update(dt, p, this.solids, this.world);
      // player attack vs enemy
      const hb = p.attackHitbox();
      if (hb && !e.dead && overlaps(hb, e.body) && !p.alreadyHit(e) && e.canBeHitFrom(p.centerX)) {
        p.markHit(e);
        const heavy = p.attackIndex === 2;
        e.takeDamage(p.currentDamage(), p.centerX, this.world, heavy);
        p.onHitConfirm(this.world, heavy);
        if (e.dead) this.onEnemyKilled(e);
      }
      // special burst
      const sb = p.specialBurst();
      if (sb && !e.dead) {
        const d = Math.hypot(e.centerX - sb.x, e.centerY - sb.y);
        if (d < sb.r && !p.alreadyHit(e)) {
          p.markHit(e);
          e.takeDamage(Math.round(PLAYER.SPECIAL_DAMAGE * p.stats.attackMult), p.centerX, this.world, true);
          if (e.dead) this.onEnemyKilled(e);
        }
      }
      // enemy attack vs player
      if (!e.dead && !p.dead) {
        const ehb = e.attackHitbox();
        if (ehb && overlaps(ehb, p.body)) {
          const dmg = e.kind === 'ash_beast' ? e.contactDamage() : 14;
          p.takeDamage(dmg, e.centerX, this.world);
        }
      }
    }
    this.enemies = this.enemies.filter((e) => !e.removeMe);

    // --- hazards
    if (!p.dead) {
      for (const h of this.level.hazards) {
        const feet = { x: p.body.x + 6, y: p.body.y + p.body.h - 10, w: p.body.w - 12, h: 10 };
        if (overlaps(feet, h)) {
          if (p.takeDamage(PLAYER.HAZARD_DAMAGE, p.centerX + (p.facing > 0 ? -1 : 1), this.world)) {
            p.body.vy = -PLAYER.HURT_KNOCKBACK_Y * 1.1;
          }
        }
      }
      // fall death
      if (p.body.y > this.level.height + PLAYER.FALL_DEATH_MARGIN) p.die(this.world);
    }

    // --- collectibles
    for (const c of this.collectibles) {
      if (c.taken) continue;
      const dx = p.centerX - c.x;
      const dy = p.centerY - c.y;
      const d = Math.hypot(dx, dy);
      if (d < COLLECT.MAGNET_RADIUS && !p.dead) c.magnet = true;
      if (c.magnet) {
        const sp = COLLECT.MAGNET_SPEED * dt;
        c.x += (dx / (d || 1)) * sp;
        c.y += (dy / (d || 1)) * sp;
      }
      if (d < 18) this.collect(c);
    }

    // --- death
    if (p.dead && !this.deathReported && p.deathElapsed(dt)) {
      this.deathReported = true;
      this.deaths++;
      this.audio.play('defeat');
      this.pause();
      this.onEvent({ type: 'death', deaths: this.deaths });
    }

    // --- exit / victory
    if (!this.victory && !p.dead && overlaps(p.body, this.level.exit)) {
      this.victory = true;
      this.exitReached = true;
      this.victoryTimer = 1.6;
      p.playVictory();
      this.audio.play('victory');
      this.particles.emit('flame', this.level.exit.x + this.level.exit.w / 2, this.level.exit.y + 40, 40, { speed: 180, life: 1.2, size: 6 });
      this.particles.emit('ember', p.centerX, p.centerY, 40, { speed: 200, life: 2, size: 3 });
    }
    if (this.victory) {
      this.victoryTimer -= dt;
      if (Math.random() < 0.4) this.particles.emit('ember', p.centerX, p.centerY - 20, 1, { speed: 60, life: 1.4 });
      if (this.victoryTimer <= 0) {
        this.pause();
        this.onEvent({ type: 'victory', result: this.buildResult() });
        this.victoryTimer = 999;
      }
    }

    // --- tutorial hints
    TUTORIAL_HINTS.forEach((h, i) => {
      if (!this.hintsShown.has(i) && p.centerX > h.x) {
        this.hintsShown.add(i);
        this.onEvent({ type: 'toast', text: h.text });
      }
    });

    // --- ambient ash (keep density within camera view)
    this.ambientTimer -= dt;
    if (this.ambientTimer <= 0) {
      this.ambientTimer = 0.12;
      this.particles.emit('ash', this.camera.x + Math.random() * (viewport.w + 200) - 100, this.camera.y - 10, 1, {
        speed: 22,
        life: 9,
        size: 1.6,
        dir: Math.PI * 0.62,
        arc: 0.5,
      });
    }

    this.particles.update(dt);
    this.camera.update(dt, p.centerX, p.centerY, p.facing, p.body.grounded);

    // --- HUD (throttled + change-detected)
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.pushHud();
    }
  }

  /* ------------------------------------------------------------ gameplay helpers */
  private lightAltar(a: AltarEntity, silent: boolean) {
    a.lit = true;
    a.litTime = silent ? 10 : 0;
    if (!silent) {
      this.audio.play('altar');
      this.camera.shake(3);
      this.particles.emit('flame', a.x, a.y - 52, 30, { speed: 160, life: 0.8, size: 6 });
      this.particles.emit('ember', a.x, a.y - 52, 30, { speed: 220, life: 1.6 });
      this.onEvent({ type: 'toast', text: 'The ancient mechanism stirs…' });
    }
    if (a.opens) {
      const g = this.gates.find((x) => x.id === a.opens);
      if (g && !g.open) {
        g.open = true;
        g.progress = silent ? 1 : 0;
        if (!silent) {
          window.setTimeout(() => this.audio.play('gate'), 400);
          window.setTimeout(() => this.camera.shake(4), 400);
        }
        this.rebuildSolids();
      }
    }
  }

  private activateCheckpoint(c: CheckpointEntity) {
    c.active = true;
    c.activeTime = 0;
    this.activeCheckpointId = c.id;
    this.respawnPoint = { x: c.x - PLAYER.WIDTH / 2, y: c.y - PLAYER.HEIGHT };
    this.player.restore();
    this.coinsAtCheckpoint = this.coins;
    this.essenceAtCheckpoint = this.essence;
    this.audio.play('checkpoint');
    this.particles.emit('flame', c.x, c.y - 82, 26, { speed: 140, life: 0.8, size: 6 });
    this.particles.emit('ember', c.x, c.y - 82, 30, { speed: 200, life: 1.8 });
    this.particles.emit('spark', c.x, c.y - 82, 14, { speed: 260, life: 0.5 });
    this.onEvent({ type: 'checkpoint', checkpoint: { id: c.id, x: c.x, y: c.y } as CheckpointSnapshot, coins: this.coins, essence: this.essence });
    this.pushHud();
  }

  private collect(c: CollectibleEntity) {
    c.taken = true;
    const p = this.player;
    switch (c.kind) {
      case 'coin':
        this.coins += COLLECT.COIN_VALUE;
        this.audio.play('pickup_coin');
        this.particles.emit('spark', c.x, c.y, 6, { speed: 120, life: 0.35, color: PALETTE.flameHot });
        break;
      case 'essence':
        this.essence += COLLECT.ESSENCE_VALUE;
        p.addFlame(25);
        this.audio.play('pickup_essence');
        this.particles.emit('flame', c.x, c.y, 14, { speed: 120, life: 0.6, size: 5 });
        this.particles.emit('ember', c.x, c.y, 12, { speed: 160, life: 1 });
        break;
      case 'health':
        p.heal(COLLECT.HEALTH_ORB_VALUE);
        this.audio.play('pickup_health');
        this.particles.emit('orb', c.x, c.y, 14, { speed: 110, life: 0.7, color: PALETTE.health, size: 3 });
        break;
    }
    this.pushHud();
  }

  private onEnemyKilled(e: Enemy) {
    this.enemiesDefeated++;
    this.coins += e.coinDrop;
    this.essence += e.essenceDrop;
    this.player.addFlame(12);
    this.camera.shake(4);
    this.hitStop = Math.max(this.hitStop, 0.08);
  }

  private buildResult(): LevelResult {
    return {
      levelId: this.level.id,
      timeSec: this.levelTime,
      enemiesDefeated: this.enemiesDefeated,
      enemiesTotal: this.level.enemies.length,
      coins: this.coins,
      essence: this.essence,
      collectiblesFound: this.collectibles.filter((c) => c.taken).length,
      collectiblesTotal: this.collectibles.length,
      deaths: this.deaths,
    };
  }

  get checkpointId() {
    return this.activeCheckpointId;
  }

  private pushHud() {
    const p = this.player;
    const hud: HudSnapshot = {
      hp: Math.ceil(p.hp),
      maxHp: p.stats.maxHp,
      flame: Math.floor(p.flame),
      maxFlame: p.stats.maxFlame,
      coins: this.coins,
      essence: this.essence,
      objective: this.gates.some((g) => !g.open) ? 'Unseal the Gate' : this.level.objective,
      dashCooldown: p.dashCooldown <= 0 ? 1 : 1 - p.dashCooldown / (PLAYER.DASH_COOLDOWN * p.stats.dashCooldownMult),
      specialReady: p.stats.specialUnlocked && p.specialCooldown <= 0 && p.flame >= PLAYER.SPECIAL_COST,
      canInteract: !!this.nearAltar,
      enemiesLeft: this.enemies.filter((e) => !e.dead).length,
    };
    const l = this.lastHud;
    if (
      l &&
      l.hp === hud.hp &&
      l.flame === hud.flame &&
      l.coins === hud.coins &&
      l.essence === hud.essence &&
      l.objective === hud.objective &&
      Math.abs(l.dashCooldown - hud.dashCooldown) < 0.05 &&
      l.specialReady === hud.specialReady &&
      l.canInteract === hud.canInteract &&
      l.enemiesLeft === hud.enemiesLeft
    )
      return;
    this.lastHud = hud;
    this.onEvent({ type: 'hud', hud });
  }

  /* ------------------------------------------------------------ render */
  private render() {
    const ctx = this.ctx;
    const camX = this.camera.renderX;
    const camY = this.camera.renderY;
    const t = this.time;
    const minX = camX - 100;
    const maxX = camX + viewport.w + 100;

    // Layers 0-3: sky, mountains, ruins, trees
    this.env.drawBackground(ctx, camX, camY, t);

    // Layer 4: gameplay environment (camera space)
    ctx.save();
    ctx.translate(-camX, -camY);

    for (const p of this.level.props) if (p.x > minX - 200 && p.x < maxX + 200) this.env.drawProp(ctx, p, t);
    this.env.drawSolids(ctx, this.level.solids, minX, maxX);
    for (const h of this.level.hazards) if (h.x + h.w > minX && h.x < maxX) this.env.drawHazard(ctx, h, t);
    for (const c of this.checkpoints) if (c.x > minX && c.x < maxX) this.env.drawCheckpoint(ctx, c.x, c.y, c.active, c.activeTime, t);
    for (const a of this.altars) if (a.x > minX && a.x < maxX) this.env.drawAltar(ctx, a.x, a.y, a.lit, a.litTime, this.nearAltar === a, t);
    for (const g of this.gates) if (g.x > minX && g.x < maxX) this.env.drawGate(ctx, g, g.progress, t);
    this.env.drawExit(ctx, this.level.exit, t, this.exitReached);
    for (const c of this.collectibles) if (!c.taken && c.x > minX && c.x < maxX) this.env.drawCollectible(ctx, c.kind, c.x, c.y, t);

    for (const e of this.enemies) if (e.centerX > minX && e.centerX < maxX) drawEnemy(ctx, e, t);
    drawPlayer(ctx, this.player, t);

    // Layer 6/7: particles & VFX
    this.particles.draw(ctx, minX, maxX);
    ctx.restore();

    // Layer 5: foreground
    this.env.drawForeground(ctx, camX, camY);

    // Lighting: the flame is the light source in a dark world
    this.renderLighting(camX, camY, t);

    // vignette
    const vg = ctx.createRadialGradient(viewport.w / 2, viewport.h / 2, viewport.h * 0.45, viewport.w / 2, viewport.h / 2, viewport.w * 0.75);
    vg.addColorStop(0, 'rgba(7,8,11,0)');
    vg.addColorStop(1, 'rgba(7,8,11,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, viewport.w, viewport.h);

    // low-health pulse
    if (this.player.hp > 0 && this.player.hp / this.player.stats.maxHp < 0.3) {
      ctx.fillStyle = `rgba(155,29,29,${0.08 + Math.sin(t * 5) * 0.06})`;
      ctx.fillRect(0, 0, viewport.w, viewport.h);
    }
  }

  private renderLighting(camX: number, camY: number, t: number) {
    const lc = this.lightCtx;
    const w = this.lightCanvas.width;
    const h = this.lightCanvas.height;
    const s = 0.5; // light canvas scale
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = 'rgba(5,6,10,0.30)';
    lc.fillRect(0, 0, w, h);
    lc.globalCompositeOperation = 'destination-out';

    const punch = (x: number, y: number, r: number, a: number) => {
      const g = lc.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(0.5, `rgba(0,0,0,${a * 0.45})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g;
      lc.fillRect(x - r, y - r, r * 2, r * 2);
    };

    const p = this.player;
    const flick = 1 + Math.sin(t * 13) * 0.04;
    const pr = (200 + p.stats.flameLevel * 22 + (p.flame / p.stats.maxFlame) * 60) * flick;
    punch((p.centerX - camX) * s, (p.centerY - camY) * s, pr * s, p.dead ? 0.5 : 1);
    for (const c of this.checkpoints) if (c.active) punch((c.x - camX) * s, (c.y - 80 - camY) * s, 130 * s, 0.9);
    for (const a of this.altars) if (a.lit) punch((a.x - camX) * s, (a.y - 50 - camY) * s, 150 * s, 0.9);
    for (const pr2 of this.level.props) if (pr2.kind === 'lantern') punch((pr2.x - camX) * s, (pr2.y + 30 - camY) * s, 90 * s, 0.8);
    punch((this.level.exit.x + this.level.exit.w / 2 - camX) * s, (this.level.exit.y + 60 - camY) * s, 170 * s, 0.9);
    for (const h of this.level.hazards) if (h.kind === 'fire') punch((h.x + h.w / 2 - camX) * s, (h.y - camY) * s, 100 * s, 0.7);

    this.ctx.drawImage(this.lightCanvas, 0, 0, viewport.w, viewport.h);

    // warm tint around the player flame (additive)
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'lighter';
    const g = this.ctx.createRadialGradient(p.centerX - camX, p.centerY - camY, 0, p.centerX - camX, p.centerY - camY, pr * 0.7);
    g.addColorStop(0, 'rgba(245,158,43,0.09)');
    g.addColorStop(1, 'rgba(245,158,43,0)');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, viewport.w, viewport.h);
    this.ctx.restore();
  }
}
