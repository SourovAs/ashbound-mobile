import { PARTICLES, PALETTE } from './config';

export type ParticleKind = 'ember' | 'ash' | 'dust' | 'spark' | 'flame' | 'smoke' | 'shard' | 'orb';

interface Particle {
  alive: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  rot: number;
  vrot: number;
}

/** Pooled particle system: fixed-size pool, zero allocations per frame. */
export class ParticleSystem {
  private pool: Particle[] = [];
  private cursor = 0;
  readonly cap = PARTICLES.POOL_SIZE;

  constructor() {
    for (let i = 0; i < this.cap; i++) {
      this.pool.push({
        alive: false,
        kind: 'ash',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: '#fff',
        gravity: 0,
        drag: 0,
        rot: 0,
        vrot: 0,
      });
    }
  }

  clear() {
    for (const p of this.pool) p.alive = false;
  }

  private next(): Particle {
    // round-robin allocation: oldest particles get recycled under pressure
    for (let i = 0; i < this.cap; i++) {
      const p = this.pool[(this.cursor + i) % this.cap];
      if (!p.alive) {
        this.cursor = (this.cursor + i + 1) % this.cap;
        return p;
      }
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.cap;
    return p;
  }

  emit(
    kind: ParticleKind,
    x: number,
    y: number,
    count: number,
    opts: Partial<{
      spread: number;
      speed: number;
      dir: number; // radians
      arc: number; // radians
      life: number;
      size: number;
      color: string;
      gravity: number;
      drag: number;
      vx: number;
      vy: number;
    }> = {},
  ) {
    const spread = opts.spread ?? 4;
    const speed = opts.speed ?? 80;
    const dir = opts.dir ?? -Math.PI / 2;
    const arc = opts.arc ?? Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const p = this.next();
      p.alive = true;
      p.kind = kind;
      p.x = x + (Math.random() - 0.5) * spread * 2;
      p.y = y + (Math.random() - 0.5) * spread * 2;
      const a = dir + (Math.random() - 0.5) * arc;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s + (opts.vx ?? 0);
      p.vy = Math.sin(a) * s + (opts.vy ?? 0);
      p.maxLife = (opts.life ?? 0.6) * (0.7 + Math.random() * 0.6);
      p.life = p.maxLife;
      p.size = (opts.size ?? 3) * (0.6 + Math.random() * 0.8);
      p.gravity = opts.gravity ?? this.defaultGravity(kind);
      p.drag = opts.drag ?? this.defaultDrag(kind);
      p.color = opts.color ?? this.defaultColor(kind);
      p.rot = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 6;
    }
  }

  private defaultGravity(k: ParticleKind) {
    switch (k) {
      case 'ember':
        return -60;
      case 'flame':
        return -220;
      case 'smoke':
        return -40;
      case 'spark':
        return 500;
      case 'shard':
        return 900;
      case 'dust':
        return -10;
      case 'orb':
        return -30;
      default:
        return 12;
    }
  }
  private defaultDrag(k: ParticleKind) {
    switch (k) {
      case 'flame':
        return 4;
      case 'dust':
      case 'smoke':
        return 3;
      case 'spark':
        return 1.5;
      case 'shard':
        return 0.4;
      default:
        return 0.6;
    }
  }
  private defaultColor(k: ParticleKind) {
    switch (k) {
      case 'ember':
        return PALETTE.flame;
      case 'flame':
        return PALETTE.flameHot;
      case 'spark':
        return PALETTE.flameCore;
      case 'dust':
        return 'rgba(138,145,163,0.5)';
      case 'smoke':
        return 'rgba(60,64,76,0.5)';
      case 'shard':
        return PALETTE.enemyBodyLight;
      case 'orb':
        return PALETTE.crystal;
      default:
        return 'rgba(184,188,203,0.55)';
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      p.vy += p.gravity * dt;
      const d = 1 - Math.min(1, p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  /** Draw particles in world space (ctx already translated by camera). */
  draw(ctx: CanvasRenderingContext2D, minX: number, maxX: number) {
    for (const p of this.pool) {
      if (!p.alive || p.x < minX - 20 || p.x > maxX + 20) continue;
      const t = p.life / p.maxLife;
      ctx.globalAlpha = p.kind === 'ash' ? Math.min(1, t * 2) * 0.7 : t;
      ctx.fillStyle = p.color;
      switch (p.kind) {
        case 'flame': {
          const s = p.size * (0.5 + t);
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, s * 0.7, s, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'shard':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size);
          ctx.restore();
          break;
        case 'spark':
          ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size * 1.6, p.size * 0.6);
          break;
        case 'smoke':
        case 'dust': {
          const s = p.size * (1.6 - t);
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        default:
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, Math.PI * 2);
          ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
