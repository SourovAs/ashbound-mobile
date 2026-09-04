import { AudioSystem } from '../../game/audio';

/**
 * Application-layer audio: menu music and UI feedback. Shares the same
 * synth engine as the runtime but is a separate instance owned by the app.
 */
class UiSound {
  private audio = new AudioSystem();
  private volumes = { music: 0.7, sfx: 0.9 };
  private unlocked = false;

  setVolumes(music: number, sfx: number) {
    this.volumes = { music, sfx };
    this.audio.setVolumes(music, sfx);
  }

  /** Call on any user gesture. */
  unlock() {
    this.audio.unlock();
    this.audio.setVolumes(this.volumes.music, this.volumes.sfx);
    this.unlocked = true;
  }

  menuMusic(on: boolean) {
    if (!this.unlocked) return;
    if (on) this.audio.startMusic('menu');
    else this.audio.stopMusic();
  }

  click() {
    this.unlock();
    this.audio.play('ui_click');
  }
  hover() {
    if (this.unlocked) this.audio.play('ui_hover');
  }
  victory() {
    this.audio.play('victory');
  }
  suspend() {
    this.audio.suspend();
  }
  resume() {
    this.audio.resume();
  }
}

export const uiSound = new UiSound();
