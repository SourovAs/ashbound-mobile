import type { LevelDef } from '../types';

const GROUND_Y = 460;
const GROUND_H = 260;

export const FOREST_1_5: LevelDef = {
  id: '1-5',
  chapter: 1,
  index: 5,
  name: 'Warden of Cinders',
  objective: 'Pass through the broken watch',
  width: 2800,
  height: 540,
  seed: 1583,
  hints: [
    { x: 720, text: 'The Warden shields his front — strike during attacks or get behind him' },
    { x: 1500, text: 'Warden of Cinders · Break the final seal' },
  ],
  spawn: { x: 120, y: GROUND_Y - 60 },
  solids: [
    { x: -200, y: GROUND_Y, w: 3000, h: GROUND_H, kind: 'ground' },
    { x: 440, y: 350, w: 160, h: 18, kind: 'stone', oneWay: true },
    { x: 720, y: 300, w: 150, h: 18, kind: 'cracked', oneWay: true },
    { x: 1080, y: 360, w: 160, h: 18, kind: 'wood', oneWay: true },
  ],
  hazards: [
    { kind: 'spikes', x: 900, y: GROUND_Y - 20, w: 120, h: 20 },
    { kind: 'spikes', x: 1260, y: GROUND_Y - 20, w: 120, h: 20 },
  ],
  enemies: [
    { kind: 'ash_grunt', x: 620, y: GROUND_Y - 56, patrolMin: 500, patrolMax: 850 },
    { kind: 'ash_beast', x: 1120, y: GROUND_Y - 40, patrolMin: 1030, patrolMax: 1360 },
    { kind: 'warden_of_cinders', x: 1950, y: GROUND_Y - 90, patrolMin: 1640, patrolMax: 2250 },
  ],
  collectibles: [
    { kind: 'coin', x: 300, y: 420 },
    { kind: 'coin', x: 500, y: 305 },
    { kind: 'essence', x: 790, y: 255 },
    { kind: 'health', x: 1450, y: 410 },
    { kind: 'essence', x: 1510, y: 410 },
    { kind: 'coin', x: 2500, y: 420 },
    { kind: 'coin', x: 2550, y: 420 },
  ],
  checkpoints: [{ id: 'cp_1_5_boss', x: 1480, y: GROUND_Y }],
  interactables: [],
  gates: [
    {
      id: 'warden_seal',
      x: 2360,
      y: GROUND_Y - 180,
      w: 48,
      h: 180,
      requiresEnemy: 'warden_of_cinders',
      objectiveHint: 'Defeat the Warden of Cinders',
    },
  ],
  props: [
    { kind: 'ruin_wall', x: 80, y: GROUND_Y, scale: 1.2 },
    { kind: 'banner', x: 520, y: GROUND_Y - 150 },
    { kind: 'pillar', x: 920, y: GROUND_Y, scale: 1.1 },
    { kind: 'arch', x: 1400, y: GROUND_Y, scale: 1.2 },
    { kind: 'lantern', x: 1600, y: GROUND_Y - 145 },
    { kind: 'pillar', x: 1760, y: GROUND_Y, scale: 1.35 },
    { kind: 'pillar', x: 2220, y: GROUND_Y, scale: 1.35, flip: true },
    { kind: 'bones', x: 2100, y: GROUND_Y },
    { kind: 'arch', x: 2500, y: GROUND_Y, scale: 1.2 },
  ],
  exit: { x: 2580, y: GROUND_Y - 170, w: 90, h: 170 },
};
