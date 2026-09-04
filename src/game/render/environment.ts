import { PALETTE, PARALLAX } from '../config';
import { viewport } from '../viewport';
import type { CollectibleKind, GateDef, HazardDef, LevelDef, PropDef, Rect, SolidDef } from '../types';
import { drawFlame } from './rigs';

type Ctx = CanvasRenderingContext2D;

/** Deterministic PRNG (mulberry32) so decoration is stable per level seed. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTile(w: number, h: number, paint: (c: Ctx) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  paint(ctx);
  return c;
}

function drawTiled(ctx: Ctx, tile: HTMLCanvasElement, offsetX: number, y: number) {
  const w = tile.width;
  let x = -(((offsetX % w) + w) % w);
  while (x < viewport.w) {
    ctx.drawImage(tile, x, y);
    x += w;
  }
}

function deadTree(ctx: Ctx, x: number, baseY: number, h: number, color: string, rnd: () => number) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const branch = (bx: number, by: number, len: number, ang: number, w: number, depth: number) => {
    if (depth === 0 || len < 4) return;
    const ex = bx + Math.sin(ang) * len;
    const ey = by - Math.cos(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const n = depth > 3 ? 2 : 1 + (rnd() < 0.6 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      branch(ex, ey, len * (0.6 + rnd() * 0.2), ang + (rnd() - 0.5) * 1.3, w * 0.65, depth - 1);
    }
  };
  branch(x, baseY, h * 0.45, (rnd() - 0.5) * 0.15, h * 0.07, 5);
}

/**
 * Environment renderer for the Ashen Forest biome. Layers are pre-rendered to
 * tiles at construction time; per-frame cost is a handful of drawImage calls.
 */
export class ForestEnvironment {
  private mountains: HTMLCanvasElement;
  private ruins: HTMLCanvasElement;
  private treesFar: HTMLCanvasElement;
  private treesMid: HTMLCanvasElement;
  private foreground: HTMLCanvasElement;
  private sky: CanvasGradient | null = null;

  constructor(level: LevelDef) {
    const rnd = seededRandom(level.seed);

    this.mountains = makeTile(1600, 320, (c) => {
      const drawRange = (color: string, base: number, amp: number, step: number) => {
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(0, 320);
        let y = base;
        for (let x = 0; x <= 1600; x += step) {
          y = base - Math.abs(Math.sin(x * 0.011 + rnd() * 0.3)) * amp - rnd() * 12;
          c.lineTo(x, y);
        }
        c.lineTo(1600, 320);
        c.closePath();
        c.fill();
      };
      drawRange(PALETTE.mountainFar, 250, 130, 40);
      drawRange(PALETTE.mountainNear, 290, 80, 30);
    });

    this.ruins = makeTile(1400, 300, (c) => {
      c.fillStyle = PALETTE.ruinFar;
      let x = 40;
      while (x < 1400) {
        const w = 30 + rnd() * 60;
        const h = 60 + rnd() * 140;
        c.fillRect(x, 300 - h, w, h);
        // broken tower tops
        if (rnd() < 0.5) {
          c.beginPath();
          c.moveTo(x, 300 - h);
          c.lineTo(x + w * 0.4, 300 - h - 20 - rnd() * 30);
          c.lineTo(x + w, 300 - h);
          c.fill();
        }
        // windows
        c.fillStyle = 'rgba(245,158,43,0.12)';
        if (rnd() < 0.3) c.fillRect(x + w * 0.4, 300 - h + 30, 6, 10);
        c.fillStyle = PALETTE.ruinFar;
        x += w + 60 + rnd() * 200;
      }
      // arch
      c.beginPath();
      c.arc(700, 300, 60, Math.PI, 0);
      c.lineTo(760, 300);
      c.lineTo(720, 300);
      c.arc(700, 300, 40, 0, Math.PI, true);
      c.lineTo(640, 300);
      c.closePath();
      c.fill();
    });

    this.treesFar = makeTile(1800, 420, (c) => {
      for (let i = 0; i < 16; i++) deadTree(c, 40 + i * 110 + rnd() * 40, 420, 200 + rnd() * 160, PALETTE.treeFar, rnd);
      // fog band
      const g = c.createLinearGradient(0, 300, 0, 420);
      g.addColorStop(0, 'rgba(120,128,148,0)');
      g.addColorStop(1, 'rgba(120,128,148,0.22)');
      c.fillStyle = g;
      c.fillRect(0, 300, 1800, 120);
    });

    this.treesMid = makeTile(2000, 480, (c) => {
      for (let i = 0; i < 10; i++) deadTree(c, 60 + i * 200 + rnd() * 80, 480, 280 + rnd() * 180, PALETTE.treeMid, rnd);
      // ground silhouette bumps
      c.fillStyle = PALETTE.treeMid;
      c.beginPath();
      c.moveTo(0, 480);
      for (let x = 0; x <= 2000; x += 50) c.lineTo(x, 470 - rnd() * 14);
      c.lineTo(2000, 480);
      c.fill();
    });

    this.foreground = makeTile(1500, 140, (c) => {
      // dark grass/thorn silhouettes at the bottom of the frame
      c.fillStyle = '#05060a';
      for (let x = 0; x < 1500; x += 6) {
        const h = 20 + rnd() * 60;
        c.beginPath();
        c.moveTo(x, 140);
        c.quadraticCurveTo(x + 4 + rnd() * 6, 140 - h * 0.6, x + (rnd() - 0.5) * 14, 140 - h);
        c.lineTo(x + 5, 140);
        c.fill();
      }
      // a couple of branches from the top
      c.strokeStyle = '#05060a';
      c.lineWidth = 6;
      c.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const bx = 200 + i * 520 + rnd() * 100;
        c.beginPath();
        c.moveTo(bx, -10);
        c.quadraticCurveTo(bx + 40, 20, bx + 90 + rnd() * 30, 30 + rnd() * 20);
        c.stroke();
      }
    });
  }

  /* ------------------------------------------------------------ background */
  drawBackground(ctx: Ctx, camX: number, camY: number, t: number) {
    if (!this.sky) {
      this.sky = ctx.createLinearGradient(0, 0, 0, viewport.h);
      this.sky.addColorStop(0, PALETTE.skyTop);
      this.sky.addColorStop(0.55, PALETTE.skyMid);
      this.sky.addColorStop(1, PALETTE.skyBottom);
    }
    ctx.fillStyle = this.sky;
    ctx.fillRect(0, 0, viewport.w, viewport.h);

    // dim ash moon
    const mx = 700 - camX * 0.02;
    ctx.fillStyle = 'rgba(184,188,203,0.08)';
    ctx.beginPath();
    ctx.arc(mx, 110, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(184,188,203,0.12)';
    ctx.beginPath();
    ctx.arc(mx, 110, 34, 0, Math.PI * 2);
    ctx.fill();

    const py = -camY;
    drawTiled(ctx, this.mountains, camX * PARALLAX.MOUNTAINS, 150 + py * PARALLAX.MOUNTAINS);
    drawTiled(ctx, this.ruins, camX * PARALLAX.RUINS_FAR, 200 + py * PARALLAX.RUINS_FAR);

    // fog band (animated drift)
    ctx.fillStyle = `${PALETTE.fog}0.10)`;
    ctx.fillRect(0, 300 + py * 0.3, viewport.w, 220);

    drawTiled(ctx, this.treesFar, camX * PARALLAX.TREES_FAR + Math.sin(t * 0.05) * 6, 90 + py * PARALLAX.TREES_FAR);
    drawTiled(ctx, this.treesMid, camX * PARALLAX.TREES_MID, 20 + py * PARALLAX.TREES_MID);

    // low fog
    const fg = ctx.createLinearGradient(0, 330, 0, viewport.h);
    fg.addColorStop(0, `${PALETTE.fog}0)`);
    fg.addColorStop(1, `${PALETTE.fog}0.25)`);
    ctx.fillStyle = fg;
    ctx.fillRect(0, 330, viewport.w, viewport.h - 330);
  }

  drawForeground(ctx: Ctx, camX: number, camY: number) {
    ctx.globalAlpha = 0.9;
    drawTiled(ctx, this.foreground, camX * PARALLAX.FOREGROUND, viewport.h - 110 - camY * 0.2);
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ world (camera space) */
  drawSolids(ctx: Ctx, solids: readonly SolidDef[], minX: number, maxX: number) {
    for (const s of solids) {
      if (s.x + s.w < minX || s.x > maxX) continue;
      if (s.kind === 'ground' || !s.kind) this.drawGround(ctx, s);
      else this.drawPlatform(ctx, s);
    }
  }

  private drawGround(ctx: Ctx, s: SolidDef) {
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    // top band
    ctx.fillStyle = PALETTE.groundTop;
    ctx.fillRect(s.x, s.y, s.w, 10);
    ctx.fillStyle = PALETTE.groundEdge;
    ctx.fillRect(s.x, s.y, s.w, 3);
    // stones
    const rnd = seededRandom(Math.floor(s.x * 7 + s.y));
    ctx.fillStyle = PALETTE.stoneDark;
    for (let x = s.x + 10; x < s.x + s.w - 20; x += 40 + rnd() * 50) {
      const y = s.y + 18 + rnd() * 60;
      ctx.fillRect(x, y, 10 + rnd() * 16, 5 + rnd() * 6);
    }
    // tuft silhouettes
    ctx.fillStyle = '#12141a';
    for (let x = s.x + 6; x < s.x + s.w - 6; x += 18 + rnd() * 30) {
      const h = 5 + rnd() * 8;
      ctx.beginPath();
      ctx.moveTo(x, s.y);
      ctx.lineTo(x + 3, s.y - h);
      ctx.lineTo(x + 6, s.y);
      ctx.fill();
    }
    // edge shading
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + 80);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x, s.y, s.w, Math.min(80, s.h));
  }

  private drawPlatform(ctx: Ctx, s: SolidDef) {
    if (s.kind === 'wood') {
      ctx.fillStyle = '#3a2a1e';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#5a4030';
      for (let x = s.x; x < s.x + s.w; x += 22) ctx.fillRect(x + 2, s.y, 18, 4);
      ctx.fillStyle = '#24170f';
      ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
      return;
    }
    ctx.fillStyle = s.kind === 'cracked' ? PALETTE.stoneDark : PALETTE.stone;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = PALETTE.stoneLight;
    ctx.fillRect(s.x, s.y, s.w, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(s.x, s.y + s.h - 5, s.w, 5);
    // block seams
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let x = s.x + 30; x < s.x + s.w; x += 34) ctx.fillRect(x, s.y + 3, 2, s.h - 3);
    if (s.kind === 'cracked') {
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x + s.w * 0.3, s.y);
      ctx.lineTo(s.x + s.w * 0.38, s.y + s.h * 0.6);
      ctx.lineTo(s.x + s.w * 0.33, s.y + s.h);
      ctx.moveTo(s.x + s.w * 0.7, s.y + s.h);
      ctx.lineTo(s.x + s.w * 0.66, s.y + s.h * 0.4);
      ctx.stroke();
    }
    // hanging moss/ash drips
    ctx.fillStyle = '#12141a';
    for (let x = s.x + 8; x < s.x + s.w - 8; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, s.y + s.h);
      ctx.lineTo(x + 3, s.y + s.h + 8);
      ctx.lineTo(x + 6, s.y + s.h);
      ctx.fill();
    }
  }

  drawHazard(ctx: Ctx, h: HazardDef, t: number) {
    if (h.kind === 'spikes') {
      ctx.fillStyle = '#1a1c22';
      ctx.fillRect(h.x, h.y + h.h - 4, h.w, 4);
      for (let x = h.x; x < h.x + h.w; x += 12) {
        ctx.fillStyle = '#6a7080';
        ctx.beginPath();
        ctx.moveTo(x, h.y + h.h);
        ctx.lineTo(x + 6, h.y);
        ctx.lineTo(x + 12, h.y + h.h);
        ctx.fill();
        ctx.fillStyle = '#c4c9d6';
        ctx.beginPath();
        ctx.moveTo(x + 4, h.y + h.h);
        ctx.lineTo(x + 6, h.y + 2);
        ctx.lineTo(x + 7, h.y + h.h);
        ctx.fill();
      }
    } else {
      for (let x = h.x + 8; x < h.x + h.w; x += 16) drawFlame(ctx, x, h.y + h.h, 8, t + x, 0.6);
    }
  }

  /* ------------------------------------------------------------ props */
  drawProp(ctx: Ctx, p: PropDef, t: number) {
    const s = p.scale ?? 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.flip ? -s : s, s);
    switch (p.kind) {
      case 'ruin_wall': {
        ctx.fillStyle = PALETTE.stoneDark;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -120);
        ctx.lineTo(30, -140);
        ctx.lineTo(60, -110);
        ctx.lineTo(80, -125);
        ctx.lineTo(110, -70);
        ctx.lineTo(130, -80);
        ctx.lineTo(140, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let y = -20; y > -120; y -= 20) ctx.fillRect(4, y, 130, 2);
        ctx.fillStyle = PALETTE.stoneLight;
        ctx.fillRect(20, -60, 26, 3);
        ctx.fillRect(70, -40, 30, 3);
        break;
      }
      case 'pillar':
        ctx.fillStyle = PALETTE.stoneDark;
        ctx.fillRect(-14, -8, 28, 8);
        ctx.fillRect(-10, -150, 20, 142);
        ctx.fillStyle = PALETTE.stone;
        ctx.fillRect(-8, -150, 6, 142);
        ctx.fillStyle = PALETTE.stoneDark;
        ctx.beginPath();
        ctx.moveTo(-10, -150);
        ctx.lineTo(-4, -166);
        ctx.lineTo(6, -156);
        ctx.lineTo(10, -150);
        ctx.fill();
        break;
      case 'arch':
        ctx.fillStyle = PALETTE.stoneDark;
        ctx.fillRect(-70, -140, 22, 140);
        ctx.fillRect(48, -140, 22, 140);
        ctx.beginPath();
        ctx.arc(0, -140, 70, Math.PI, 0);
        ctx.lineTo(48, -140);
        ctx.arc(0, -140, 48, 0, Math.PI, true);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.stone;
        ctx.fillRect(-66, -140, 4, 140);
        ctx.fillRect(52, -140, 4, 140);
        break;
      case 'crate':
        ctx.fillStyle = '#3a2a1e';
        ctx.fillRect(-14, -28, 28, 28);
        ctx.strokeStyle = '#1d140d';
        ctx.lineWidth = 2;
        ctx.strokeRect(-13, -27, 26, 26);
        ctx.beginPath();
        ctx.moveTo(-13, -27);
        ctx.lineTo(13, -1);
        ctx.moveTo(13, -27);
        ctx.lineTo(-13, -1);
        ctx.stroke();
        break;
      case 'barrel':
        ctx.fillStyle = '#3a2a1e';
        ctx.beginPath();
        ctx.ellipse(0, -15, 12, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5b6274';
        ctx.fillRect(-12, -22, 24, 2);
        ctx.fillRect(-12, -10, 24, 2);
        break;
      case 'lantern': {
        ctx.strokeStyle = '#2a2e38';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(0, 0);
        ctx.lineTo(0, 14);
        ctx.stroke();
        ctx.strokeStyle = PALETTE.stoneDark;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-40, 0);
        ctx.lineTo(-40, 120);
        ctx.stroke();
        ctx.fillStyle = '#1e2028';
        ctx.fillRect(-7, 14, 14, 20);
        ctx.scale(1 / (p.flip ? -s : s), 1 / s);
        drawFlame(ctx, 0, 30 * s, 4, t * 1.1 + p.x, 0.9);
        break;
      }
      case 'bones':
        ctx.fillStyle = '#9a9384';
        ctx.beginPath();
        ctx.arc(-6, -6, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#12141a';
        ctx.fillRect(-9, -8, 3, 3);
        ctx.fillRect(-4, -8, 3, 3);
        ctx.strokeStyle = '#9a9384';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(4, -2);
        ctx.lineTo(26, -6);
        ctx.moveTo(8, -1);
        ctx.lineTo(24, 0);
        ctx.stroke();
        break;
      case 'banner': {
        ctx.strokeStyle = PALETTE.stoneDark;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 150);
        ctx.moveTo(-4, 4);
        ctx.lineTo(34, 4);
        ctx.stroke();
        const w = Math.sin(t * 1.6 + p.x) * 3;
        ctx.fillStyle = PALETTE.cloakDark;
        ctx.beginPath();
        ctx.moveTo(4, 6);
        ctx.lineTo(32, 6);
        ctx.lineTo(30 + w, 70);
        ctx.lineTo(18 + w, 62);
        ctx.lineTo(6 + w, 74);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = PALETTE.flame;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(18 + w * 0.4, 30, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'cart':
        ctx.fillStyle = '#3a2a1e';
        ctx.beginPath();
        ctx.moveTo(-30, -14);
        ctx.lineTo(30, -22);
        ctx.lineTo(34, -40);
        ctx.lineTo(-24, -34);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#1d140d';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(-14, -8, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(30, -22);
        ctx.lineTo(60, -6);
        ctx.stroke();
        break;
      case 'tree_dead':
        deadTree(ctx, 0, 0, 200, PALETTE.treeMid, seededRandom(p.x));
        break;
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ interactive */
  drawCheckpoint(ctx: Ctx, x: number, y: number, active: boolean, activateTime: number, t: number) {
    // stone shrine with brazier
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(x - 18, y - 10, 36, 10);
    ctx.fillRect(x - 12, y - 70, 24, 60);
    ctx.fillStyle = PALETTE.stone;
    ctx.fillRect(x - 10, y - 70, 5, 60);
    // brazier bowl
    ctx.fillStyle = '#2a2521';
    ctx.beginPath();
    ctx.moveTo(-16 + x, y - 72);
    ctx.lineTo(16 + x, y - 72);
    ctx.lineTo(10 + x, y - 84);
    ctx.lineTo(-10 + x, y - 84);
    ctx.closePath();
    ctx.fill();
    // runes
    ctx.fillStyle = active ? PALETTE.flame : PALETTE.ashGray;
    ctx.globalAlpha = active ? 0.8 + Math.sin(t * 4) * 0.2 : 0.5;
    ctx.fillRect(x - 3, y - 50, 6, 2);
    ctx.fillRect(x - 5, y - 42, 10, 2);
    ctx.fillRect(x - 3, y - 34, 6, 2);
    ctx.globalAlpha = 1;
    if (active) {
      const grow = Math.min(1, activateTime / 0.6);
      drawFlame(ctx, x, y - 82, 8 * grow + 3, t, 1);
    } else {
      // dormant ember
      ctx.fillStyle = `rgba(234,106,26,${0.3 + Math.sin(t * 2) * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y - 78, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawAltar(ctx: Ctx, x: number, y: number, lit: boolean, litTime: number, near: boolean, t: number) {
    // ancient altar
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(x - 30, y - 12, 60, 12);
    ctx.fillRect(x - 22, y - 44, 44, 32);
    ctx.fillStyle = PALETTE.stone;
    ctx.fillRect(x - 26, y - 48, 52, 6);
    // carved inscription
    ctx.fillStyle = lit ? PALETTE.flameHot : PALETTE.ashGray;
    ctx.globalAlpha = lit ? 0.9 : near ? 0.6 + Math.sin(t * 5) * 0.3 : 0.35;
    for (let i = 0; i < 4; i++) ctx.fillRect(x - 16 + i * 9, y - 32, 5, 2);
    ctx.globalAlpha = 1;
    // flame bowl
    ctx.fillStyle = '#2a2521';
    ctx.beginPath();
    ctx.ellipse(x, y - 50, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (lit) {
      const grow = Math.min(1, litTime / 0.8);
      drawFlame(ctx, x, y - 52, 6 + 8 * grow, t, 1);
    }
    if (near && !lit) {
      // interaction hint glyph
      ctx.save();
      ctx.globalAlpha = 0.85 + Math.sin(t * 6) * 0.15;
      ctx.fillStyle = PALETTE.flameHot;
      ctx.font = 'bold 12px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('IGNITE', x, y - 74 + Math.sin(t * 3) * 2);
      ctx.restore();
    }
  }

  drawGate(ctx: Ctx, g: GateDef, openProgress: number, t: number) {
    // frame
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(g.x - 16, g.y - 20, 16, g.h + 20);
    ctx.fillRect(g.x + g.w, g.y - 20, 16, g.h + 20);
    ctx.fillRect(g.x - 20, g.y - 30, g.w + 40, 14);
    ctx.fillStyle = PALETTE.stone;
    ctx.fillRect(g.x - 14, g.y - 20, 4, g.h + 20);
    ctx.fillRect(g.x + g.w + 2, g.y - 20, 4, g.h + 20);
    // bars rise into the lintel
    const rise = openProgress * g.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(g.x - 2, g.y - 16, g.w + 4, g.h + 16);
    ctx.clip();
    ctx.fillStyle = '#4a4f5c';
    for (let bx = g.x + 4; bx < g.x + g.w; bx += 10) ctx.fillRect(bx, g.y - rise, 4, g.h);
    ctx.fillStyle = '#2a2e38';
    ctx.fillRect(g.x, g.y + 30 - rise, g.w, 5);
    ctx.fillRect(g.x, g.y + g.h - 40 - rise, g.w, 5);
    ctx.restore();
    // lock rune
    ctx.fillStyle = openProgress > 0 ? PALETTE.flameHot : PALETTE.enemyCorrupt;
    ctx.globalAlpha = 0.7 + Math.sin(t * 3) * 0.3;
    ctx.beginPath();
    ctx.arc(g.x + g.w / 2, g.y - 23, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawExit(ctx: Ctx, r: Rect, t: number, reached: boolean) {
    const cx = r.x + r.w / 2;
    // massive ancient gate
    ctx.fillStyle = PALETTE.stoneDark;
    ctx.fillRect(r.x - 24, r.y - 10, 24, r.h + 10);
    ctx.fillRect(r.x + r.w, r.y - 10, 24, r.h + 10);
    ctx.beginPath();
    ctx.arc(cx, r.y, r.w / 2 + 24, Math.PI, 0);
    ctx.lineTo(r.x + r.w, r.y);
    ctx.arc(cx, r.y, r.w / 2, 0, Math.PI, true);
    ctx.closePath();
    ctx.fill();
    // inner portal glow
    const g = ctx.createLinearGradient(0, r.y - r.w / 2, 0, r.y + r.h);
    const a = reached ? 0.7 : 0.25 + Math.sin(t * 1.5) * 0.08;
    g.addColorStop(0, `rgba(245,158,43,${a})`);
    g.addColorStop(1, 'rgba(234,106,26,0.02)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, r.y, r.w / 2, Math.PI, 0);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.lineTo(r.x, r.y + r.h);
    ctx.closePath();
    ctx.fill();
    // carved lines
    ctx.strokeStyle = PALETTE.stone;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x - 20, r.y + 20);
    ctx.lineTo(r.x - 20, r.y + r.h - 10);
    ctx.moveTo(r.x + r.w + 20, r.y + 20);
    ctx.lineTo(r.x + r.w + 20, r.y + r.h - 10);
    ctx.stroke();
    ctx.fillStyle = PALETTE.flameHot;
    ctx.globalAlpha = 0.6 + Math.sin(t * 2) * 0.3;
    ctx.beginPath();
    ctx.arc(cx, r.y - r.w / 2 - 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawCollectible(ctx: Ctx, kind: CollectibleKind, x: number, y: number, t: number) {
    const bob = Math.sin(t * 3 + x * 0.05) * 3;
    ctx.save();
    ctx.translate(x, y + bob);
    if (kind === 'coin') {
      const sq = Math.abs(Math.cos(t * 3 + x * 0.1));
      ctx.fillStyle = '#8f6a1f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7 * sq + 1, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.flameHot;
      ctx.beginPath();
      ctx.ellipse(-1, 0, 5.5 * sq + 0.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8f6a1f';
      ctx.fillRect(-1.5 * sq, -3, 3 * sq, 6);
    } else if (kind === 'essence') {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, 'rgba(245,158,43,0.5)');
      g.addColorStop(1, 'rgba(245,158,43,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = PALETTE.flameDeep;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(7, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.flameCore;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(3.5, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-3.5, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, 'rgba(217,70,58,0.45)');
      g.addColorStop(1, 'rgba(217,70,58,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = PALETTE.health;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd6d0';
      ctx.beginPath();
      ctx.arc(-2, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
