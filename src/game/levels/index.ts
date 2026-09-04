import type { LevelDef } from '../types';
import { FOREST_1_1 } from './forest_1_1';
import { FOREST_1_2 } from './forest_1_2';
import { FOREST_1_3 } from './forest_1_3';
import { FOREST_1_4 } from './forest_1_4';
import { FOREST_1_5 } from './forest_1_5';

export const LEVELS: Partial<Record<string, LevelDef>> = {
  [FOREST_1_1.id]: FOREST_1_1,
  [FOREST_1_2.id]: FOREST_1_2,
  [FOREST_1_3.id]: FOREST_1_3,
  [FOREST_1_4.id]: FOREST_1_4,
  [FOREST_1_5.id]: FOREST_1_5,
};

export const FIRST_LEVEL = FOREST_1_1;
