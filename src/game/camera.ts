import { FEEL } from './config';
import { viewport } from './viewport';

/**
 * Side-view camera: smooth horizontal follow with facing look-ahead,
 * dead-zoned vertical follow, decaying trauma-based shake and level clamping.
 */
export class Camera {
  x = 0;
  y = 0;
  private targetY = 0;
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private lookahead = 0;
  private t = 0;
  private reduceShake = false;

  levelWidth = 4000;
  levelHeight = 540;

  setReducedShake(v: boolean) {
    this.reduceShake = v;
  }

  snapTo(px: number, py: number) {
    this.x = this.clampX(px - viewport.w / 2);
    this.y = this.clampY(py - viewport.h * 0.58);
    this.targetY = this.y;
    this.lookahead = 0;
  }

  shake(amount: number) {
    this.trauma = Math.min(1, this.trauma + amount / 10);
  }

  update(dt: number, px: number, py: number, facing: number, grounded: boolean) {
    this.t += dt;
    // horizontal: look ahead in facing direction
    const wantLook = facing * FEEL.CAMERA_LOOKAHEAD;
    this.lookahead += (wantLook - this.lookahead) * Math.min(1, dt * 2.2);
    const targetX = px + this.lookahead - viewport.w / 2;
    this.x += (targetX - this.x) * Math.min(1, dt * FEEL.CAMERA_LERP);

    // vertical: only follow when grounded or far outside the deadzone
    const desired = py - viewport.h * 0.58;
    const diff = desired - this.targetY;
    if (grounded || Math.abs(diff) > FEEL.CAMERA_DEADZONE_Y * 1.6) {
      this.targetY = desired;
    }
    this.y += (this.targetY - this.y) * Math.min(1, dt * FEEL.CAMERA_VERTICAL_LERP);

    this.x = this.clampX(this.x);
    this.y = this.clampY(this.y);

    // shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * (FEEL.SHAKE_DECAY / 10));
      const mag = (this.reduceShake ? 0.3 : 1) * this.trauma * this.trauma * 14;
      this.shakeX = (Math.sin(this.t * 91.3) + Math.sin(this.t * 43.7)) * 0.5 * mag;
      this.shakeY = (Math.cos(this.t * 77.1) + Math.sin(this.t * 51.9)) * 0.5 * mag;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  private clampX(x: number) {
    return Math.max(0, Math.min(this.levelWidth - viewport.w, x));
  }
  private clampY(y: number) {
    return Math.max(-120, Math.min(this.levelHeight - viewport.h + 40, y));
  }

  get renderX() {
    return Math.round((this.x + this.shakeX) * 2) / 2;
  }
  get renderY() {
    return Math.round((this.y + this.shakeY) * 2) / 2;
  }
}
