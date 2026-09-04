import type { LevelDef } from '../types';

const GROUND_Y = 460;
const GROUND_H = 260;

/**
 * ASHEN FOREST — 1-1 "The Waking Ember"
 * Tutorial pacing: move → jump → first enemy → platforms → checkpoint →
 * hazard → flame altar interaction → gate → beast → ancient gate.
 */
export const FOREST_1_1: LevelDef = {
  id: '1-1',
  chapter: 1,
  index: 1,
  name: 'The Waking Ember',
  objective: 'Find the Ancient Gate',
  width: 4300,
  height: 540,
  seed: 1187,
  spawn: { x: 120, y: GROUND_Y - 60 },

  solids: [
    // --- Segment A: opening path
    { x: -200, y: GROUND_Y, w: 900, h: GROUND_H, kind: 'ground' },
    // spike pit floor (shallow, escapable)
    { x: 700, y: GROUND_Y + 70, w: 100, h: GROUND_H, kind: 'ground' },
    { x: 800, y: GROUND_Y, w: 720, h: GROUND_H, kind: 'ground' },

    // stepped platforms
    { x: 1240, y: 380, w: 130, h: 18, kind: 'stone', oneWay: true },
    { x: 1410, y: 310, w: 130, h: 18, kind: 'cracked', oneWay: true },

    // --- Segment B: after death pit (1520–1600)
    { x: 1600, y: GROUND_Y, w: 820, h: GROUND_H, kind: 'ground' },
    { x: 2230, y: 370, w: 140, h: 18, kind: 'wood', oneWay: true },

    // --- Segment C: altar & gate (gap 2420–2500)
    { x: 2500, y: GROUND_Y, w: 820, h: GROUND_H, kind: 'ground' },
    { x: 2560, y: 360, w: 110, h: 18, kind: 'stone', oneWay: true },

    // --- Segment D: final approach (gap 3320–3400)
    { x: 3400, y: GROUND_Y, w: 1100, h: GROUND_H, kind: 'ground' },
    { x: 3620, y: 380, w: 120, h: 18, kind: 'stone', oneWay: true },
    { x: 3790, y: 320, w: 120, h: 18, kind: 'cracked', oneWay: true },
  ],

  hazards: [
    { kind: 'spikes', x: 700, y: GROUND_Y + 50, w: 100, h: 20 },
    { kind: 'spikes', x: 2240, y: GROUND_Y - 20, w: 120, h: 20 },
  ],

  enemies: [
    { kind: 'ash_grunt', x: 1000, y: GROUND_Y - 56, patrolMin: 880, patrolMax: 1180 },
    { kind: 'ash_grunt', x: 1950, y: GROUND_Y - 56, patrolMin: 1820, patrolMax: 2150 },
    { kind: 'ash_grunt', x: 3050, y: GROUND_Y - 56, patrolMin: 2960, patrolMax: 3250 },
    { kind: 'ash_beast', x: 3600, y: GROUND_Y - 40, patrolMin: 3470, patrolMax: 3900 },
  ],

  collectibles: [
    { kind: 'coin', x: 320, y: 420 },
    { kind: 'coin', x: 360, y: 420 },
    { kind: 'coin', x: 400, y: 420 },
    { kind: 'coin', x: 560, y: 380 },
    { kind: 'coin', x: 600, y: 360 },
    { kind: 'coin', x: 640, y: 380 },
    { kind: 'coin', x: 1300, y: 340 },
    { kind: 'essence', x: 1475, y: 265 },
    { kind: 'coin', x: 1700, y: 420 },
    { kind: 'coin', x: 1740, y: 420 },
    { kind: 'coin', x: 2300, y: 330 },
    { kind: 'essence', x: 2615, y: 315 },
    { kind: 'coin', x: 2800, y: 420 },
    { kind: 'coin', x: 2840, y: 420 },
    { kind: 'coin', x: 2880, y: 420 },
    { kind: 'health', x: 3440, y: 410 },
    { kind: 'coin', x: 3680, y: 340 },
    { kind: 'essence', x: 3850, y: 275 },
    { kind: 'coin', x: 4000, y: 420 },
    { kind: 'coin', x: 4040, y: 420 },
  ],

  checkpoints: [
    { id: 'cp_1', x: 1720, y: GROUND_Y },
    { id: 'cp_2', x: 3460, y: GROUND_Y },
  ],

  interactables: [
    { id: 'altar_1', kind: 'flame_altar', x: 2700, y: GROUND_Y, opens: 'gate_1', flameCost: 20 },
  ],

  gates: [{ id: 'gate_1', x: 2900, y: GROUND_Y - 150, w: 36, h: 150 }],

  props: [
    { kind: 'ruin_wall', x: 40, y: GROUND_Y, scale: 1 },
    { kind: 'lantern', x: 230, y: GROUND_Y - 120 },
    { kind: 'bones', x: 520, y: GROUND_Y },
    { kind: 'pillar', x: 860, y: GROUND_Y, scale: 0.9 },
    { kind: 'arch', x: 1330, y: GROUND_Y, scale: 1 },
    { kind: 'crate', x: 1660, y: GROUND_Y },
    { kind: 'banner', x: 1790, y: GROUND_Y - 150 },
    { kind: 'cart', x: 2050, y: GROUND_Y },
    { kind: 'pillar', x: 2180, y: GROUND_Y, scale: 1.1, flip: true },
    { kind: 'ruin_wall', x: 2520, y: GROUND_Y, scale: 0.8 },
    { kind: 'barrel', x: 2620, y: GROUND_Y },
    { kind: 'lantern', x: 2860, y: GROUND_Y - 140 },
    { kind: 'bones', x: 3130, y: GROUND_Y },
    { kind: 'crate', x: 3560, y: GROUND_Y },
    { kind: 'pillar', x: 3960, y: GROUND_Y, scale: 1.2 },
    { kind: 'pillar', x: 4220, y: GROUND_Y, scale: 1.2, flip: true },
  ],

  exit: { x: 4090, y: GROUND_Y - 170, w: 90, h: 170 },
};
