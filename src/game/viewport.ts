import { VIEW } from './config';

/**
 * Mutable logical viewport. Height is fixed (540); width adapts to the device
 * aspect ratio (clamped) so wide phones see more world instead of letterboxing.
 * Single source of truth updated by the engine on resize.
 */
export const viewport = {
  w: VIEW.WIDTH as number,
  h: VIEW.HEIGHT as number,
  scale: 1,
  dpr: 1,
};

export const VIEW_MIN_W = 800;
export const VIEW_MAX_W = 1280;
