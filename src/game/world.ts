import type { AudioSystem } from './audio';
import type { Camera } from './camera';
import type { ParticleSystem } from './particles';
import type { RuntimeEvent } from './types';

/**
 * Services exposed to entities (player, enemies, interactables).
 * Entities never reach into the engine directly — they use this narrow contract.
 */
export interface WorldServices {
  particles: ParticleSystem;
  audio: AudioSystem;
  camera: Camera;
  requestHitStop(seconds: number): void;
  emit(e: RuntimeEvent): void;
  time: number;
}
