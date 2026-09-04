import type { Rect, SolidDef } from './types';

export interface Body extends Rect {
  vx: number;
  vy: number;
  grounded: boolean;
  wallDir: 0 | 1 | -1;
  hitCeiling: boolean;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Move a body against a solid list with axis separation. One-way platforms
 * only collide when moving downward and the body's feet were above them.
 */
export function moveBody(b: Body, dt: number, solids: readonly SolidDef[], dropThrough = false) {
  b.grounded = false;
  b.wallDir = 0;
  b.hitCeiling = false;

  // --- horizontal
  const dx = b.vx * dt;
  b.x += dx;
  for (const s of solids) {
    if (s.oneWay) continue;
    if (!overlaps(b, s)) continue;
    if (dx > 0) {
      b.x = s.x - b.w;
      b.wallDir = 1;
    } else if (dx < 0) {
      b.x = s.x + s.w;
      b.wallDir = -1;
    }
    b.vx = 0;
  }

  // --- vertical
  const prevBottom = b.y + b.h;
  const dy = b.vy * dt;
  b.y += dy;
  for (const s of solids) {
    if (!overlaps(b, s)) continue;
    if (s.oneWay) {
      if (dropThrough || dy < 0 || prevBottom > s.y + 1) continue;
      b.y = s.y - b.h;
      b.vy = 0;
      b.grounded = true;
      continue;
    }
    if (dy > 0) {
      b.y = s.y - b.h;
      b.vy = 0;
      b.grounded = true;
    } else if (dy < 0) {
      b.y = s.y + s.h;
      b.vy = 0;
      b.hitCeiling = true;
    }
  }
}

/** Ground probe: is there solid ground within `dist` below the body's feet at offset x? */
export function groundAhead(b: Rect, dirX: number, solids: readonly SolidDef[], dist = 10): boolean {
  const probe: Rect = { x: dirX > 0 ? b.x + b.w + 4 : b.x - 8, y: b.y + b.h + 1, w: 4, h: dist };
  for (const s of solids) if (overlaps(probe, s)) return true;
  return false;
}

/** Simple horizontal cast to see if a wall blocks the way. */
export function wallAhead(b: Rect, dirX: number, solids: readonly SolidDef[], dist = 6): boolean {
  const probe: Rect = { x: dirX > 0 ? b.x + b.w : b.x - dist, y: b.y + 4, w: dist, h: b.h - 8 };
  for (const s of solids) if (!s.oneWay && overlaps(probe, s)) return true;
  return false;
}
