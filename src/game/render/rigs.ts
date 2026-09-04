import { PALETTE, PLAYER } from '../config';
import type { AshBeast, AshGrunt, Enemy, WardenOfCinders } from '../enemies';
import type { Player } from '../player';

type Ctx = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ helpers */

/** Draw a limb segment from (x,y) with given length/angle. Angle 0 = down, + = forward. */
function limb(ctx: Ctx, x: number, y: number, len: number, angle: number, width: number, color: string): [number, number] {
  const ex = x + Math.sin(angle) * len;
  const ey = y + Math.cos(angle) * len;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  return [ex, ey];
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Pose {
  bob: number;
  lean: number;
  head: number;
  fShoulder: number;
  fElbow: number;
  bShoulder: number;
  bElbow: number;
  fHip: number;
  fKnee: number;
  bHip: number;
  bKnee: number;
  sword: number;
  scaleX: number;
  scaleY: number;
  rot: number;
  crouch: number;
}

function basePose(): Pose {
  return {
    bob: 0,
    lean: 0,
    head: 0,
    fShoulder: 0.15,
    fElbow: 0.35,
    bShoulder: -0.15,
    bElbow: -0.5,
    fHip: 0.1,
    fKnee: 0,
    bHip: -0.1,
    bKnee: 0,
    sword: 0.4,
    scaleX: 1,
    scaleY: 1,
    rot: 0,
    crouch: 0,
  };
}

/* ------------------------------------------------------------------ player pose */

function playerPose(p: Player, t: number): Pose {
  const pose = basePose();
  const at = p.animTime;
  switch (p.anim) {
    case 'idle': {
      const breathe = Math.sin(t * 2.2);
      pose.bob = breathe * 0.8;
      pose.fShoulder = 0.18 + breathe * 0.03;
      pose.bShoulder = -0.2 - breathe * 0.03;
      pose.bElbow = -0.9;
      pose.head = breathe * 0.02;
      // idle variation: glance at flame
      if (p.idleTime > 5 && p.idleTime % 9 < 2.4) {
        const k = Math.sin(((p.idleTime % 9) / 2.4) * Math.PI);
        pose.head = -0.25 * k;
        pose.bShoulder = -0.2 - 0.8 * k;
        pose.bElbow = -0.9 - 0.6 * k;
      }
      break;
    }
    case 'run': {
      const c = p.runCycle;
      const s = Math.sin(c);
      pose.lean = 0.2;
      pose.bob = -Math.abs(Math.sin(c)) * 2.2;
      pose.fHip = s * 0.85;
      pose.fKnee = Math.max(0, Math.sin(c - 1.0)) * 1.3;
      pose.bHip = -s * 0.85;
      pose.bKnee = Math.max(0, Math.sin(c + Math.PI - 1.0)) * 1.3;
      pose.fShoulder = -s * 0.7 + 0.1;
      pose.fElbow = 0.9;
      pose.bShoulder = s * 0.7 - 0.2;
      pose.bElbow = -1.0;
      pose.sword = 0.6;
      break;
    }
    case 'jump': {
      const k = easeOut(Math.min(1, at / 0.18));
      pose.lean = -0.08;
      pose.fHip = lerp(0.3, 0.8, k);
      pose.fKnee = lerp(0.4, 1.4, k);
      pose.bHip = -0.25;
      pose.bKnee = 0.7;
      pose.fShoulder = lerp(0.2, -0.5, k);
      pose.fElbow = 0.6;
      pose.bShoulder = lerp(-0.2, -1.4, k);
      pose.bElbow = -0.6;
      pose.scaleY = lerp(1.08, 1, k);
      pose.scaleX = lerp(0.94, 1, k);
      break;
    }
    case 'fall':
      pose.lean = 0.05;
      pose.fHip = 0.45;
      pose.fKnee = 0.8;
      pose.bHip = -0.3;
      pose.bKnee = 0.3;
      pose.fShoulder = -0.9 + Math.sin(t * 8) * 0.05;
      pose.fElbow = 0.3;
      pose.bShoulder = -1.7;
      pose.bElbow = -0.4;
      break;
    case 'land':
      pose.crouch = 8;
      pose.lean = 0.25;
      pose.fHip = 0.7;
      pose.fKnee = 1.5;
      pose.bHip = -0.5;
      pose.bKnee = 1.2;
      pose.fShoulder = 0.5;
      pose.bShoulder = -0.7;
      pose.scaleX = 1.12;
      pose.scaleY = 0.88;
      break;
    case 'dash':
      pose.lean = 0.55;
      pose.fHip = -0.9;
      pose.fKnee = 0.6;
      pose.bHip = 0.5;
      pose.bKnee = 1.2;
      pose.fShoulder = 1.6;
      pose.fElbow = 0.2;
      pose.bShoulder = -1.3;
      pose.bElbow = -0.7;
      pose.sword = -0.4;
      pose.scaleX = 1.15;
      pose.scaleY = 0.92;
      break;
    case 'attack1': {
      const k = easeOut(Math.min(1, p.attackProgress / 0.55));
      pose.lean = lerp(-0.1, 0.3, k);
      pose.fShoulder = lerp(-2.3, 1.55, k);
      pose.fElbow = lerp(-0.4, 0.2, k);
      pose.sword = lerp(1.0, -0.2, k);
      pose.bShoulder = lerp(-0.8, -1.5, k);
      pose.bElbow = -0.5;
      pose.fHip = 0.5;
      pose.fKnee = 0.6;
      pose.bHip = -0.5;
      pose.bKnee = 0.2;
      break;
    }
    case 'attack2': {
      const k = easeOut(Math.min(1, p.attackProgress / 0.55));
      pose.lean = lerp(0.35, -0.05, k);
      pose.fShoulder = lerp(1.9, -1.9, k);
      pose.fElbow = lerp(0.3, -0.5, k);
      pose.sword = lerp(-0.3, 1.2, k);
      pose.bShoulder = lerp(-1.6, -0.6, k);
      pose.fHip = 0.35;
      pose.fKnee = 0.5;
      pose.bHip = -0.6;
      pose.bKnee = 0.4;
      break;
    }
    case 'attack3': {
      const k = easeInOut(Math.min(1, p.attackProgress / 0.5));
      pose.lean = lerp(-0.35, 0.5, k);
      pose.fShoulder = lerp(-3.0, 1.2, k);
      pose.fElbow = lerp(-0.6, 0.5, k);
      pose.sword = lerp(1.4, -0.3, k);
      pose.bShoulder = lerp(-2.0, -1.0, k);
      pose.crouch = k * 6;
      pose.fHip = lerp(0.1, 0.8, k);
      pose.fKnee = lerp(0.1, 1.4, k);
      pose.bHip = lerp(-0.2, -0.7, k);
      pose.bKnee = lerp(0.1, 1.0, k);
      pose.scaleY = lerp(1.06, 0.95, k);
      break;
    }
    case 'special': {
      const k = Math.min(1, at / 0.16);
      pose.bob = -k * 6;
      pose.lean = -0.15;
      pose.fShoulder = lerp(0, 2.2, k);
      pose.fElbow = 0.1;
      pose.bShoulder = lerp(0, -2.2, k);
      pose.bElbow = -0.1;
      pose.fHip = 0.4;
      pose.fKnee = 0.6;
      pose.bHip = -0.4;
      pose.bKnee = 0.6;
      pose.sword = 0.8;
      break;
    }
    case 'hurt':
      pose.lean = -0.5;
      pose.head = -0.3;
      pose.fShoulder = -1.0;
      pose.fElbow = 0.9;
      pose.bShoulder = -1.4;
      pose.bElbow = -0.8;
      pose.fHip = 0.5;
      pose.fKnee = 0.8;
      pose.bHip = -0.2;
      pose.bKnee = 0.5;
      break;
    case 'dead': {
      const k = easeOut(Math.min(1, at / 0.5));
      pose.rot = -k * (Math.PI / 2 - 0.05);
      pose.bob = k * 20;
      pose.lean = 0;
      pose.fShoulder = 0.6;
      pose.bShoulder = -0.4;
      pose.fHip = 0.2;
      pose.bHip = -0.1;
      break;
    }
    case 'interact': {
      const k = Math.sin(Math.min(1, at / 0.55) * Math.PI);
      pose.lean = 0.2 * k;
      pose.crouch = 4 * k;
      pose.bShoulder = -0.2 - 1.9 * k;
      pose.bElbow = -0.2;
      pose.fShoulder = 0.3;
      pose.fHip = 0.4 * k;
      pose.fKnee = 0.6 * k;
      break;
    }
    case 'victory': {
      const k = easeOut(Math.min(1, at / 0.5));
      pose.fShoulder = lerp(0.2, -2.9, k);
      pose.fElbow = -0.1;
      pose.sword = lerp(0.4, -0.2, k);
      pose.bShoulder = -0.5;
      pose.bElbow = -1.0;
      pose.bob = -Math.abs(Math.sin(k * Math.PI)) * 8;
      break;
    }
  }
  // landing squash
  if (p.landSquash > 0 && p.anim !== 'dead') {
    pose.scaleY *= 1 - p.landSquash * 0.16;
    pose.scaleX *= 1 + p.landSquash * 0.14;
  }
  return pose;
}

/* ------------------------------------------------------------------ flame */

export function drawFlame(ctx: Ctx, x: number, y: number, size: number, t: number, intensity = 1) {
  const flick = 1 + Math.sin(t * 17) * 0.08 + Math.sin(t * 29.3) * 0.05;
  const s = size * flick;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // outer glow
  const g = ctx.createRadialGradient(x, y, 0, x, y, s * 3.2);
  g.addColorStop(0, `rgba(245,158,43,${0.32 * intensity})`);
  g.addColorStop(0.5, `rgba(234,106,26,${0.1 * intensity})`);
  g.addColorStop(1, 'rgba(234,106,26,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, s * 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // tongues
  ctx.save();
  ctx.translate(x, y);
  for (let i = 0; i < 3; i++) {
    const ph = t * (9 + i * 3) + i * 2.1;
    const h = s * (1.6 + Math.sin(ph) * 0.35) * (1 - i * 0.22);
    const w = s * (0.75 - i * 0.15);
    const ox = Math.sin(ph * 0.7) * s * 0.25;
    ctx.fillStyle = i === 0 ? PALETTE.flameDeep : i === 1 ? PALETTE.flame : PALETTE.flameHot;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 1.1, -h * 0.45, ox, -h);
    ctx.quadraticCurveTo(w * 1.1, -h * 0.45, w, 0);
    ctx.quadraticCurveTo(0, w * 0.9, -w, 0);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.flameCore;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.2, s * 0.32, s * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ player draw */

export function drawPlayer(ctx: Ctx, p: Player, t: number) {
  const pose = playerPose(p, t);
  const feetX = p.centerX;
  const feetY = p.body.y + p.body.h;
  const facing = p.facing;

  // blink when invulnerable (not while dashing/dead)
  if (p.invuln > 0 && !p.isDashing && !p.dead && Math.floor(t * 22) % 2 === 0) ctx.globalAlpha = 0.45;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(feetX, feetY + 2, 16 * pose.scaleX, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(feetX, feetY);
  ctx.rotate(pose.rot * facing);
  ctx.scale(facing * pose.scaleX, pose.scaleY);
  ctx.translate(0, pose.bob + pose.crouch);

  const hipY = -26 + pose.crouch;
  const hipX = 0;
  // torso lean pivot at hip
  const shoulderX = hipX + Math.sin(pose.lean) * 18;
  const shoulderY = hipY - Math.cos(pose.lean) * 18;
  const headX = shoulderX + Math.sin(pose.lean + pose.head) * 9;
  const headY = shoulderY - Math.cos(pose.lean + pose.head) * 9;

  // ---- cloak (back layer)
  const sway = -(p.body.vx / (PLAYER.RUN_SPEED * p.stats.moveMult)) * facing * 14 + Math.sin(t * 3.1) * 1.5 - (p.body.vy / 900) * 8;
  ctx.fillStyle = PALETTE.cloak;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 7, shoulderY + 1);
  ctx.lineTo(shoulderX + 4, shoulderY + 1);
  ctx.quadraticCurveTo(shoulderX + 2 + sway * 0.4, hipY + 6, shoulderX - 2 + sway, hipY + 18);
  ctx.lineTo(shoulderX - 16 + sway * 1.3, hipY + 16);
  ctx.quadraticCurveTo(shoulderX - 12 + sway * 0.5, hipY - 4, shoulderX - 7, shoulderY + 1);
  ctx.fill();
  ctx.fillStyle = PALETTE.cloakDark;
  ctx.beginPath();
  ctx.moveTo(shoulderX - 7, shoulderY + 1);
  ctx.quadraticCurveTo(shoulderX - 12 + sway * 0.5, hipY - 4, shoulderX - 16 + sway * 1.3, hipY + 16);
  ctx.lineTo(shoulderX - 10 + sway * 1.1, hipY + 15);
  ctx.quadraticCurveTo(shoulderX - 8 + sway * 0.4, hipY - 2, shoulderX - 4, shoulderY + 1);
  ctx.fill();

  // ---- back leg
  const [bkX, bkY] = limb(ctx, hipX - 3, hipY, 13, pose.bHip, 7, PALETTE.armor);
  const [bfX, bfY] = limb(ctx, bkX, bkY, 13, pose.bHip - pose.bKnee, 6, PALETTE.armorLight);
  boot(ctx, bfX, bfY, pose.bHip - pose.bKnee, PALETTE.leather);

  // ---- back arm (flame hand)
  const [beX, beY] = limb(ctx, shoulderX - 4, shoulderY + 2, 11, pose.bShoulder, 6, PALETTE.armor);
  const [bhX, bhY] = limb(ctx, beX, beY, 11, pose.bShoulder + pose.bElbow, 5, PALETTE.leather);

  // ---- torso
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(-pose.lean);
  ctx.fillStyle = PALETTE.armor;
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.lineTo(9, -14);
  ctx.lineTo(8, -19);
  ctx.lineTo(-8, -19);
  ctx.lineTo(-8, -14);
  ctx.closePath();
  ctx.fill();
  // chest plate highlight
  ctx.fillStyle = PALETTE.armorLight;
  ctx.beginPath();
  ctx.moveTo(-2, -17);
  ctx.lineTo(7, -17);
  ctx.lineTo(6, -6);
  ctx.lineTo(0, -4);
  ctx.closePath();
  ctx.fill();
  // belt
  ctx.fillStyle = PALETTE.leather;
  ctx.fillRect(-8, -3, 16, 3);
  ctx.fillStyle = PALETTE.flame;
  ctx.fillRect(-1, -3, 3, 3);
  // shoulder plate
  ctx.fillStyle = PALETTE.armorLight;
  ctx.beginPath();
  ctx.ellipse(6, -18, 6, 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- front leg
  const [fkX, fkY] = limb(ctx, hipX + 3, hipY, 13, pose.fHip, 7, PALETTE.armorLight);
  const [ffX, ffY] = limb(ctx, fkX, fkY, 13, pose.fHip - pose.fKnee, 6, PALETTE.armorLight);
  boot(ctx, ffX, ffY, pose.fHip - pose.fKnee, PALETTE.leather);

  // ---- head
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(-(pose.lean + pose.head));
  // neck
  ctx.fillStyle = PALETTE.skin;
  ctx.fillRect(-2, 2, 4, 5);
  // face
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  // hair (pale, swept back)
  ctx.fillStyle = PALETTE.hair;
  ctx.beginPath();
  ctx.moveTo(5, -2);
  ctx.quadraticCurveTo(4, -8, -2, -7);
  ctx.quadraticCurveTo(-9, -6, -9.5, 1);
  ctx.quadraticCurveTo(-10, 5, -7, 7);
  ctx.quadraticCurveTo(-7, 2, -5, -1);
  ctx.quadraticCurveTo(-3, -3.5, 2, -2.5);
  ctx.quadraticCurveTo(4, -2, 5, -2);
  ctx.fill();
  // hair strands
  ctx.beginPath();
  ctx.moveTo(-8, 3);
  ctx.quadraticCurveTo(-12, 7, -10.5, 12);
  ctx.quadraticCurveTo(-9.5, 7, -7, 6);
  ctx.fill();
  // eye
  ctx.fillStyle = '#2a1a12';
  ctx.fillRect(3, -1, 2, 2);
  ctx.restore();

  // ---- front arm + sword
  const [feX, feY] = limb(ctx, shoulderX + 4, shoulderY + 2, 11, pose.fShoulder, 6, PALETTE.armorLight);
  const foreAngle = pose.fShoulder + pose.fElbow;
  const [fhX, fhY] = limb(ctx, feX, feY, 11, foreAngle, 5, PALETTE.leather);
  drawSword(ctx, fhX, fhY, foreAngle + pose.sword, p.stats.flameLevel, t);

  // hand
  ctx.fillStyle = PALETTE.skin;
  ctx.beginPath();
  ctx.arc(fhX, fhY, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // ---- flame in back hand (drawn last so glow sits on top)
  const flameSize = 4 + p.stats.flameLevel * 0.9 + (p.flame / p.stats.maxFlame) * 2;
  ctx.save();
  ctx.scale(facing, 1); // un-mirror so gradients/tongues stay upright
  drawFlame(ctx, bhX * facing, bhY - 2, flameSize, t, p.dead ? 0.3 : 1);
  ctx.restore();

  ctx.restore();
  ctx.globalAlpha = 1;

  // ---- attack trail (world space)
  if (p.isAttacking && p.attackProgress > 0.15 && p.attackProgress < 0.7) {
    const k = (p.attackProgress - 0.15) / 0.55;
    const cx = p.centerX + facing * 14;
    const cy = p.centerY - 4;
    const r = p.attackIndex === 2 ? 52 : 42;
    const start = p.anim === 'attack2' ? Math.PI * 0.55 : -Math.PI * 0.6;
    const end = p.anim === 'attack2' ? -Math.PI * 0.55 : Math.PI * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(facing, 1);
    ctx.globalAlpha = (1 - k) * 0.85;
    ctx.strokeStyle = p.stats.flameLevel >= 3 ? PALETTE.flameHot : 'rgba(230,235,245,0.9)';
    ctx.lineWidth = 3 + (1 - k) * 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const sweep = easeOut(Math.min(1, k * 1.4));
    ctx.arc(0, 0, r, start, lerp(start, end, sweep), p.anim === 'attack2');
    ctx.stroke();
    ctx.globalAlpha = (1 - k) * 0.35;
    ctx.strokeStyle = PALETTE.flame;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();
  }

  // special burst ring
  if (p.anim === 'special') {
    const k = Math.min(1, p.animTime / 0.35);
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = PALETTE.flameHot;
    ctx.lineWidth = 6 * (1 - k) + 1;
    ctx.beginPath();
    ctx.arc(p.centerX, p.centerY, PLAYER.SPECIAL_RADIUS * easeOut(k), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function boot(ctx: Ctx, x: number, y: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle * 0.4);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(7, -2);
  ctx.lineTo(8, 2);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSword(ctx: Ctx, x: number, y: number, angle: number, flameLevel: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // grip
  ctx.fillStyle = PALETTE.leather;
  ctx.fillRect(-1.5, -6, 3, 8);
  // guard
  ctx.fillStyle = PALETTE.steel;
  ctx.fillRect(-6, 1, 12, 2.5);
  // blade
  ctx.fillStyle = flameLevel >= 3 ? '#e8d4b0' : PALETTE.steel;
  ctx.beginPath();
  ctx.moveTo(-2.5, 3);
  ctx.lineTo(2.5, 3);
  ctx.lineTo(1.5, 34);
  ctx.lineTo(0, 38);
  ctx.lineTo(-1.5, 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-0.4, 4, 0.8, 29);
  if (flameLevel >= 3) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(245,158,43,${0.35 + Math.sin(t * 20) * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(0, 20, 4, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ enemies */

export function drawEnemy(ctx: Ctx, e: Enemy, t: number) {
  if (e.kind === 'ash_beast') drawBeast(ctx, e as AshBeast, t);
  else if (e.kind === 'warden_of_cinders') drawWarden(ctx, e as WardenOfCinders, t);
  else drawGrunt(ctx, e as AshGrunt, t);
}

function drawGrunt(ctx: Ctx, e: AshGrunt, t: number) {
  const feetX = e.centerX;
  const feetY = e.body.y + e.body.h;
  const dying = e.dead ? Math.min(1, 1 - e.deathTimer / 0.7) : 0;
  const walking = e.state === 'patrol' || e.state === 'chase';
  const speed = e.state === 'chase' ? 12 : 6;
  const c = walking ? e.animTime * speed : 0;
  const s = Math.sin(c);
  const windup = e.windupProgress;

  ctx.save();
  ctx.globalAlpha = 1 - dying;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(feetX, feetY + 2, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(feetX, feetY);
  ctx.rotate(dying * 1.2 * e.facing);
  ctx.translate(0, dying * 14);
  ctx.scale(e.facing, 1);
  if (e.hitFlash > 0) ctx.filter = 'brightness(3)';

  const hipY = -24;
  const lean = windup > 0 ? -0.35 * windup : e.state === 'attack' ? 0.5 : 0.12;
  const shX = Math.sin(lean) * 18;
  const shY = hipY - Math.cos(lean) * 18;
  const body = PALETTE.enemyBody;
  const light = PALETTE.enemyBodyLight;

  // back leg / arm
  const [bk] = [limb(ctx, -3, hipY, 12, -s * 0.7, 7, body)];
  limb(ctx, bk[0], bk[1], 12, -s * 0.7 - Math.max(0, Math.sin(c + Math.PI - 1)) * 1.1, 6, body);
  const [be] = [limb(ctx, shX - 4, shY + 3, 11, s * 0.5 - 0.3, 6, body)];
  limb(ctx, be[0], be[1], 10, s * 0.5 - 0.9, 5, body);

  // torso (hunched, ragged)
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(-lean);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(9, 0);
  ctx.lineTo(11, -12);
  ctx.lineTo(6, -21);
  ctx.lineTo(-8, -20);
  ctx.lineTo(-10, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(-2, -18);
  ctx.lineTo(6, -19);
  ctx.lineTo(8, -8);
  ctx.lineTo(1, -4);
  ctx.closePath();
  ctx.fill();
  // ragged cloth
  ctx.fillStyle = '#1a1712';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(9, 0);
  ctx.lineTo(7, 9 + Math.sin(t * 5) * 1.5);
  ctx.lineTo(2, 6);
  ctx.lineTo(-3, 10);
  ctx.lineTo(-8, 7);
  ctx.closePath();
  ctx.fill();
  // corruption cracks
  ctx.strokeStyle = PALETTE.enemyCorrupt;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.lineTo(-1, -9);
  ctx.lineTo(-3, -4);
  ctx.moveTo(3, -16);
  ctx.lineTo(4, -11);
  ctx.stroke();
  ctx.restore();

  // head (hooded skull)
  const hx = shX + Math.sin(lean) * 8;
  const hy = shY - Math.cos(lean) * 8;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(hx - 9, hy + 5);
  ctx.quadraticCurveTo(hx - 10, hy - 9, hx, hy - 10);
  ctx.quadraticCurveTo(hx + 10, hy - 8, hx + 8, hy + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0c0b09';
  ctx.beginPath();
  ctx.ellipse(hx + 1, hy, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // glowing eyes
  const glow = 0.7 + Math.sin(t * 6) * 0.2 + windup * 0.6;
  ctx.fillStyle = `rgba(255,122,26,${Math.min(1, glow)})`;
  ctx.fillRect(hx + 1, hy - 2, 3, 2);
  ctx.fillRect(hx + 5, hy - 2, 2, 2);

  // front leg
  const [fk] = [limb(ctx, 3, hipY, 12, s * 0.7, 7, light)];
  limb(ctx, fk[0], fk[1], 12, s * 0.7 - Math.max(0, Math.sin(c - 1)) * 1.1, 6, light);

  // front arm + rusted blade
  let armA = -s * 0.5 + 0.3;
  let elbow = 0.5;
  if (windup > 0) {
    armA = -2.4 * easeOut(windup);
    elbow = -0.3;
  } else if (e.state === 'attack') {
    armA = 1.6;
    elbow = 0.2;
  } else if (e.state === 'recover') {
    armA = 1.2 - e.stateTime;
    elbow = 0.4;
  }
  const [fe] = [limb(ctx, shX + 4, shY + 3, 11, armA, 6, light)];
  const [fhx, fhy] = limb(ctx, fe[0], fe[1], 10, armA + elbow, 5, light);
  ctx.save();
  ctx.translate(fhx, fhy);
  ctx.rotate(armA + elbow + 0.3);
  ctx.fillStyle = '#5a4a3a';
  ctx.fillRect(-1.5, -5, 3, 7);
  ctx.fillStyle = '#7c8291';
  ctx.beginPath();
  ctx.moveTo(-3, 2);
  ctx.lineTo(3, 2);
  ctx.lineTo(4, 22);
  ctx.lineTo(-1, 30);
  ctx.lineTo(-3, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // telegraph flash
  if (windup > 0.55 && !e.dead) {
    ctx.save();
    ctx.globalAlpha = (windup - 0.55) * 2 * (0.5 + Math.sin(t * 40) * 0.5);
    ctx.fillStyle = PALETTE.enemyEye;
    ctx.beginPath();
    ctx.arc(e.centerX + e.facing * 30, e.centerY - 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawEnemyHealth(ctx, e);
}

function drawBeast(ctx: Ctx, e: AshBeast, t: number) {
  const feetX = e.centerX;
  const feetY = e.body.y + e.body.h;
  const dying = e.dead ? Math.min(1, 1 - e.deathTimer / 0.7) : 0;
  const moving = e.state === 'patrol' || e.state === 'attack';
  const c = moving ? e.animTime * (e.state === 'attack' ? 22 : 8) : 0;
  const windup = e.windupProgress;

  ctx.save();
  ctx.globalAlpha = 1 - dying;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(feetX, feetY + 2, 30, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(feetX, feetY + dying * 10);
  ctx.scale(e.facing, 1 - dying * 0.4);
  if (e.hitFlash > 0) ctx.filter = 'brightness(3)';

  const crouch = windup * 6;
  const body = PALETTE.enemyBody;
  const light = PALETTE.enemyBodyLight;

  // legs (4)
  const legs = [-20, -8, 8, 20];
  legs.forEach((lx, i) => {
    const ph = c + (i % 2) * Math.PI;
    const a = Math.sin(ph) * 0.6;
    const [kx, ky] = limb(ctx, lx, -22 + crouch, 11, a, 6, i < 2 ? body : light);
    limb(ctx, kx, ky, 12, a - 0.4 - Math.max(0, Math.sin(ph - 1)) * 0.9, 5, i < 2 ? body : light);
  });

  // body
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-30, -20 + crouch);
  ctx.quadraticCurveTo(-34, -36 + crouch, -14, -38 + crouch);
  ctx.lineTo(18, -40 + crouch);
  ctx.quadraticCurveTo(32, -38 + crouch, 30, -22 + crouch);
  ctx.quadraticCurveTo(0, -14 + crouch, -30, -20 + crouch);
  ctx.fill();
  // spine spikes
  ctx.fillStyle = light;
  for (let i = 0; i < 5; i++) {
    const sx = -22 + i * 9;
    ctx.beginPath();
    ctx.moveTo(sx - 3, -37 + crouch);
    ctx.lineTo(sx, -46 + crouch - i);
    ctx.lineTo(sx + 3, -37 + crouch);
    ctx.fill();
  }
  // cracks
  ctx.strokeStyle = PALETTE.enemyCorrupt;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-10, -30 + crouch);
  ctx.lineTo(-4, -25 + crouch);
  ctx.lineTo(-8, -20 + crouch);
  ctx.moveTo(8, -34 + crouch);
  ctx.lineTo(12, -27 + crouch);
  ctx.stroke();

  // head
  const hx = 30;
  const hy = -30 + crouch + Math.sin(t * 4) * 0.5;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(hx - 8, hy - 10);
  ctx.lineTo(hx + 14, hy - 6);
  ctx.lineTo(hx + 16, hy + 2);
  ctx.lineTo(hx + 4, hy + 8);
  ctx.lineTo(hx - 8, hy + 6);
  ctx.closePath();
  ctx.fill();
  // jaw
  ctx.fillStyle = '#0c0b09';
  ctx.fillRect(hx + 2, hy + 1, 12, 3);
  ctx.fillStyle = '#d8d0c0';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(hx + 3 + i * 3, hy + 1);
    ctx.lineTo(hx + 4.5 + i * 3, hy + 5);
    ctx.lineTo(hx + 6 + i * 3, hy + 1);
    ctx.fill();
  }
  // eyes
  const glow = 0.7 + Math.sin(t * 7) * 0.2 + windup;
  ctx.fillStyle = `rgba(255,122,26,${Math.min(1, glow)})`;
  ctx.fillRect(hx + 4, hy - 4, 4, 2);
  ctx.fillRect(hx - 2, hy - 5, 3, 2);
  ctx.restore();

  drawEnemyHealth(ctx, e);
}

function drawWarden(ctx: Ctx, e: WardenOfCinders, t: number) {
  const feetX = e.centerX;
  const feetY = e.body.y + e.body.h;
  const dying = e.dead ? Math.min(1, 1 - e.deathTimer / 0.7) : 0;
  const windup = e.windupProgress;
  const f = e.facing;
  const stride = Math.sin(e.animTime * 7) * (e.state === 'chase' ? 0.7 : 0.2);

  ctx.save();
  ctx.globalAlpha = 1 - dying;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(feetX, feetY + 3, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(feetX, feetY + dying * 18);
  ctx.rotate(dying * -0.9 * f);
  ctx.scale(f, 1 - dying * 0.25);
  if (e.hitFlash > 0) ctx.filter = 'brightness(3)';

  limb(ctx, -10, -35, 27, -stride, 12, '#241c18');
  limb(ctx, 10, -35, 27, stride, 12, '#352722');

  ctx.fillStyle = '#211a19';
  ctx.beginPath();
  ctx.moveTo(-25, -30);
  ctx.lineTo(25, -30);
  ctx.lineTo(20, -82);
  ctx.lineTo(10, -92);
  ctx.lineTo(-13, -92);
  ctx.lineTo(-22, -76);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7d3a20';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-18, -65);
  ctx.lineTo(18, -65);
  ctx.stroke();

  ctx.fillStyle = '#50423d';
  ctx.fillRect(-14, -108, 28, 22);
  ctx.fillStyle = '#181315';
  ctx.beginPath();
  ctx.moveTo(-18, -108);
  ctx.lineTo(-10, -124);
  ctx.lineTo(-3, -111);
  ctx.lineTo(4, -126);
  ctx.lineTo(13, -109);
  ctx.lineTo(18, -104);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = `rgba(255,112,28,${0.75 + Math.sin(t * 8) * 0.2})`;
  ctx.fillRect(2, -102, 8, 3);

  const shieldX = 25;
  ctx.fillStyle = '#49352e';
  ctx.beginPath();
  ctx.moveTo(shieldX - 13, -83);
  ctx.quadraticCurveTo(shieldX + 14, -78, shieldX + 12, -50);
  ctx.lineTo(shieldX, -38);
  ctx.lineTo(shieldX - 13, -51);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#9b4a24';
  ctx.lineWidth = 3;
  ctx.stroke();

  let swordAngle = 0.25;
  if (e.state === 'windup') swordAngle = -1.8 * windup;
  else if (e.state === 'attack') swordAngle = e.attackType === 0 ? 1.45 : -0.45;
  const [handX, handY] = limb(ctx, -15, -76, 27, swordAngle, 9, '#45332d');
  ctx.save();
  ctx.translate(handX, handY);
  ctx.rotate(swordAngle);
  ctx.fillStyle = '#6f7782';
  ctx.fillRect(-4, -8, 8, 60);
  ctx.fillStyle = '#d85d1d';
  ctx.globalAlpha = e.isEnraged ? 0.9 : 0.55 + windup * 0.35;
  ctx.fillRect(-2, 0, 4, 48);
  ctx.restore();
  ctx.restore();

  if (e.attackType === 2 && (e.state === 'windup' || e.state === 'attack')) {
    ctx.save();
    ctx.globalAlpha = e.state === 'windup' ? 0.25 + windup * 0.45 : 0.9;
    ctx.strokeStyle = PALETTE.flameHot;
    ctx.lineWidth = e.state === 'attack' ? 10 : 3;
    ctx.beginPath();
    ctx.moveTo(e.pillarX, feetY);
    ctx.lineTo(e.pillarX, feetY - 115);
    ctx.stroke();
    if (e.state === 'attack') drawFlame(ctx, e.pillarX, feetY - 70, 18, t, 1.2);
    ctx.restore();
  }

  drawEnemyHealth(ctx, e);
}

function drawEnemyHealth(ctx: Ctx, e: Enemy) {
  if (e.dead || e.hp >= e.maxHp) return;
  const w = e.kind === 'warden_of_cinders' ? 72 : 36;
  const x = e.centerX - w / 2;
  const y = e.body.y - 12;
  ctx.fillStyle = 'rgba(7,8,11,0.8)';
  ctx.fillRect(x - 1, y - 1, w + 2, 5);
  ctx.fillStyle = PALETTE.health;
  ctx.fillRect(x, y, w * (e.hp / e.maxHp), 3);
}
