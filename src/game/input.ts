/**
 * Input aggregator: merges keyboard and virtual (touch) input into a single
 * per-frame snapshot with edge detection. React only pushes virtual button
 * states in — it never reads per-frame input.
 */
export type Action = 'left' | 'right' | 'jump' | 'attack' | 'dash' | 'special' | 'interact' | 'pause';

const ACTIONS: Action[] = ['left', 'right', 'jump', 'attack', 'dash', 'special', 'interact', 'pause'];

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  KeyZ: 'jump',
  KeyJ: 'attack',
  KeyX: 'attack',
  KeyK: 'dash',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
  KeyC: 'dash',
  KeyL: 'special',
  KeyV: 'special',
  KeyE: 'interact',
  KeyF: 'interact',
  ArrowDown: 'interact',
  KeyS: 'interact',
  Escape: 'pause',
  KeyP: 'pause',
};

export class InputSystem {
  private keyboard = new Set<Action>();
  private virtual = new Set<Action>();
  /** analog horizontal axis from virtual stick (-1..1) */
  private virtualAxis = 0;

  private down = new Set<Action>();
  private prev = new Set<Action>();
  private pressedThisFrame = new Set<Action>();
  private releasedThisFrame = new Set<Action>();

  private onKeyDown = (e: KeyboardEvent) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    this.keyboard.add(a);
  };
  private onKeyUp = (e: KeyboardEvent) => {
    const a = KEYMAP[e.code];
    if (a) this.keyboard.delete(a);
  };
  private onBlur = () => {
    this.keyboard.clear();
    this.virtual.clear();
    this.virtualAxis = 0;
  };

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  /** Called by the virtual control layer. */
  setVirtual(action: Action, active: boolean) {
    if (active) this.virtual.add(action);
    else this.virtual.delete(action);
  }

  setVirtualAxis(v: number) {
    this.virtualAxis = Math.max(-1, Math.min(1, v));
  }

  clearAll() {
    this.onBlur();
  }

  /** Must be called once per fixed update before reading input. */
  poll() {
    this.prev = new Set(this.down);
    this.down.clear();
    for (const a of ACTIONS) {
      if (this.keyboard.has(a) || this.virtual.has(a)) this.down.add(a);
    }
    if (this.virtualAxis < -0.3) this.down.add('left');
    if (this.virtualAxis > 0.3) this.down.add('right');

    this.pressedThisFrame.clear();
    this.releasedThisFrame.clear();
    for (const a of ACTIONS) {
      const now = this.down.has(a);
      const was = this.prev.has(a);
      if (now && !was) this.pressedThisFrame.add(a);
      if (!now && was) this.releasedThisFrame.add(a);
    }
  }

  isDown(a: Action) {
    return this.down.has(a);
  }
  pressed(a: Action) {
    return this.pressedThisFrame.has(a);
  }
  released(a: Action) {
    return this.releasedThisFrame.has(a);
  }

  /** Horizontal axis -1..1 */
  axis(): number {
    const kb = (this.down.has('right') ? 1 : 0) - (this.down.has('left') ? 1 : 0);
    if (Math.abs(this.virtualAxis) > 0.3 && kb !== 0) {
      return Math.sign(this.virtualAxis) === kb ? Math.max(Math.abs(this.virtualAxis), 0.6) * kb : kb;
    }
    if (kb !== 0) return kb;
    return Math.abs(this.virtualAxis) > 0.3 ? this.virtualAxis : 0;
  }
}
