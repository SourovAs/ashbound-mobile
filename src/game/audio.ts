/**
 * Audio architecture: a single AudioContext with Music and SFX buses.
 * SFX are synthesized procedurally (no external asset dependency, zero load
 * failures). Music is a layered atmospheric drone with a slow ember pulse.
 */
export type SfxName =
  | 'jump'
  | 'double_jump'
  | 'land'
  | 'footstep'
  | 'swing'
  | 'hit'
  | 'hit_heavy'
  | 'dash'
  | 'special'
  | 'hurt'
  | 'death'
  | 'enemy_death'
  | 'pickup_coin'
  | 'pickup_essence'
  | 'pickup_health'
  | 'checkpoint'
  | 'altar'
  | 'gate'
  | 'ui_click'
  | 'ui_hover'
  | 'victory'
  | 'defeat'
  | 'enemy_alert'
  | 'beast_roar';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private musicVolume = 0.7;
  private sfxVolume = 0.9;
  private lastPlay = new Map<SfxName, number>();
  private musicMode: 'none' | 'explore' | 'menu' = 'none';

  /** Must be called from a user gesture on mobile. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 1;
        this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicVolume * 0.5;
        this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxVolume;
        this.sfxBus.connect(this.master);
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.05);
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ---------------------------------------------------------------- music
  startMusic(mode: 'explore' | 'menu') {
    if (!this.ctx || !this.musicBus) return;
    if (this.musicMode === mode) return;
    this.stopMusic();
    this.musicMode = mode;
    const ctx = this.ctx;
    const bus = this.musicBus;

    const root = mode === 'menu' ? 55 : 49; // A1 / G1
    const partials = mode === 'menu' ? [1, 1.5, 2, 3.01, 4.5] : [1, 1.498, 2.0, 2.996, 6.02];
    const gains = [0.5, 0.22, 0.16, 0.08, 0.03];

    partials.forEach((p, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sawtooth' : 'sine';
      osc.frequency.value = root * p;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.setTargetAtTime(gains[i], ctx.currentTime, 2.5);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220 + i * 60;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + i * 0.023;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 60;
      lfo.connect(lfoG).connect(lp.frequency);
      osc.connect(lp).connect(g).connect(bus);
      osc.start();
      lfo.start();
      this.musicNodes.push(osc, lfo, g, lp, lfoG);
    });

    // wind noise bed
    const noise = this.noiseSource(8);
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 400;
    nf.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0;
    ng.gain.setTargetAtTime(0.045, ctx.currentTime, 3);
    const nlfo = ctx.createOscillator();
    nlfo.frequency.value = 0.07;
    const nlfoG = ctx.createGain();
    nlfoG.gain.value = 250;
    nlfo.connect(nlfoG).connect(nf.frequency);
    noise.connect(nf).connect(ng).connect(bus);
    noise.start();
    nlfo.start();
    this.musicNodes.push(noise, nf, ng, nlfo, nlfoG);

    // sparse melodic embers
    const scale = mode === 'menu' ? [0, 3, 7, 10, 12, 15] : [0, 2, 3, 7, 8, 12];
    const pluck = () => {
      if (!this.ctx || this.musicMode !== mode) return;
      const t = ctx.currentTime;
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const f = root * 4 * Math.pow(2, deg / 12);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 3.6);
      this.musicTimer = window.setTimeout(pluck, 2600 + Math.random() * 4200);
    };
    this.musicTimer = window.setTimeout(pluck, 1800);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    for (const n of this.musicNodes) {
      try {
        if ('stop' in n && typeof (n as AudioScheduledSourceNode).stop === 'function') (n as AudioScheduledSourceNode).stop();
        n.disconnect();
      } catch {
        /* node already stopped */
      }
    }
    this.musicNodes = [];
    this.musicMode = 'none';
  }

  // ---------------------------------------------------------------- sfx
  play(name: SfxName) {
    if (!this.ctx || !this.sfxBus) return;
    const now = performance.now();
    const last = this.lastPlay.get(name) ?? 0;
    const minGap = name === 'footstep' ? 140 : 30;
    if (now - last < minGap) return;
    this.lastPlay.set(name, now);

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.sfxBus;

    switch (name) {
      case 'jump':
        this.tone(out, t, 'square', 220, 440, 0.14, 0.12);
        break;
      case 'double_jump':
        this.tone(out, t, 'square', 330, 660, 0.14, 0.1);
        this.tone(out, t + 0.03, 'sine', 660, 990, 0.14, 0.06);
        break;
      case 'land':
        this.noiseBurst(out, t, 0.08, 0.25, 200);
        this.tone(out, t, 'sine', 90, 50, 0.1, 0.25);
        break;
      case 'footstep':
        this.noiseBurst(out, t, 0.04, 0.06, 900);
        break;
      case 'swing':
        this.noiseBurst(out, t, 0.14, 0.14, 1800, 500);
        break;
      case 'hit':
        this.noiseBurst(out, t, 0.07, 0.35, 2500);
        this.tone(out, t, 'square', 180, 60, 0.09, 0.22);
        break;
      case 'hit_heavy':
        this.noiseBurst(out, t, 0.12, 0.45, 1600);
        this.tone(out, t, 'sawtooth', 120, 35, 0.18, 0.35);
        break;
      case 'dash':
        this.noiseBurst(out, t, 0.18, 0.22, 3000, 400);
        this.tone(out, t, 'sine', 500, 180, 0.16, 0.08);
        break;
      case 'special':
        this.noiseBurst(out, t, 0.4, 0.4, 1200, 200);
        this.tone(out, t, 'sawtooth', 80, 30, 0.45, 0.3);
        this.tone(out, t + 0.05, 'sine', 440, 880, 0.3, 0.12);
        break;
      case 'hurt':
        this.tone(out, t, 'sawtooth', 300, 90, 0.2, 0.25);
        this.noiseBurst(out, t, 0.1, 0.2, 800);
        break;
      case 'death':
        this.tone(out, t, 'sawtooth', 260, 40, 0.9, 0.3);
        this.noiseBurst(out, t, 0.6, 0.3, 500, 80);
        break;
      case 'enemy_death':
        this.noiseBurst(out, t, 0.35, 0.3, 700, 120);
        this.tone(out, t, 'triangle', 200, 40, 0.4, 0.2);
        break;
      case 'pickup_coin':
        this.tone(out, t, 'sine', 880, 1320, 0.09, 0.1);
        this.tone(out, t + 0.06, 'sine', 1320, 1760, 0.12, 0.08);
        break;
      case 'pickup_essence':
        this.tone(out, t, 'triangle', 520, 1040, 0.25, 0.12);
        this.tone(out, t + 0.08, 'sine', 1040, 1560, 0.3, 0.08);
        break;
      case 'pickup_health':
        this.tone(out, t, 'sine', 440, 660, 0.2, 0.12);
        this.tone(out, t + 0.12, 'sine', 660, 880, 0.3, 0.1);
        break;
      case 'checkpoint':
        [0, 0.12, 0.24, 0.42].forEach((d, i) =>
          this.tone(out, t + d, 'triangle', [392, 523, 659, 784][i], [392, 523, 659, 784][i], 0.5, 0.12),
        );
        this.noiseBurst(out, t, 0.6, 0.12, 900, 200);
        break;
      case 'altar':
        this.noiseBurst(out, t, 0.7, 0.25, 600, 150);
        this.tone(out, t, 'sine', 110, 220, 0.8, 0.2);
        this.tone(out, t + 0.2, 'triangle', 440, 660, 0.6, 0.1);
        break;
      case 'gate':
        this.noiseBurst(out, t, 1.2, 0.35, 300, 60);
        this.tone(out, t, 'sawtooth', 60, 40, 1.2, 0.2);
        break;
      case 'ui_click':
        this.tone(out, t, 'triangle', 660, 520, 0.07, 0.08);
        break;
      case 'ui_hover':
        this.tone(out, t, 'sine', 900, 900, 0.04, 0.03);
        break;
      case 'victory':
        [0, 0.15, 0.3, 0.45, 0.75].forEach((d, i) =>
          this.tone(out, t + d, 'triangle', [523, 659, 784, 1046, 1318][i], [523, 659, 784, 1046, 1318][i], 0.8, 0.12),
        );
        break;
      case 'defeat':
        [0, 0.3, 0.6].forEach((d, i) => this.tone(out, t + d, 'sawtooth', [220, 196, 147][i], [220, 196, 147][i] * 0.98, 0.9, 0.12));
        break;
      case 'enemy_alert':
        this.tone(out, t, 'square', 150, 220, 0.12, 0.08);
        break;
      case 'beast_roar':
        this.tone(out, t, 'sawtooth', 90, 60, 0.5, 0.25);
        this.noiseBurst(out, t, 0.5, 0.2, 400, 120);
        break;
    }
  }

  // ---------------------------------------------------------------- synth helpers
  private tone(out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(out: AudioNode, t: number, dur: number, vol: number, f0: number, f1?: number) {
    if (!this.ctx) return;
    const src = this.noiseSource(dur + 0.05);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private noiseSource(seconds: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = seconds >= 4;
    return src;
  }

  destroy() {
    this.stopMusic();
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
