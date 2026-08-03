/**
 * Turns keyboard and touch into a single tiny intent object the game reads
 * once per frame: { up, down, left, right, action, actionPressed, startPressed }.
 *
 * On touch devices it exposes a set of circular zones (in logical canvas
 * coordinates) that the HUD draws and the pointer handlers hit-test against.
 */

const KEY_MAP = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'action',
};

const SWALLOWED = new Set(Object.keys(KEY_MAP).concat(['Enter']));

export const TOUCH_ZONES = {
  up: { x: 88, y: 372, radius: 44, glyph: '▲' },
  down: { x: 88, y: 470, radius: 44, glyph: '▼' },
  action: { x: 872, y: 372, radius: 50, glyph: 'AIR' },
  // Kept left of the corner so they don't sit under the mute indicator.
  left: { x: 690, y: 470, radius: 40, glyph: '↺' },
  right: { x: 812, y: 470, radius: 40, glyph: '↻' },
};

export class Input {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(clientX:number, clientY:number) => {x:number,y:number}} toLogical
   */
  constructor(canvas, toLogical) {
    this.canvas = canvas;
    this.toLogical = toLogical;

    this.held = { up: false, down: false, left: false, right: false, action: false };
    this.keyHeld = new Set();
    this.pointerZones = new Map();

    this.actionPressed = false;
    this.startPressed = false;
    this.pausePressed = false;
    this.mutePressed = false;
    this.anyInputSeen = false;
    this.touchActive = false;

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.touchActive = window.matchMedia('(pointer: coarse)').matches;
    }

    this.bind();
  }

  bind() {
    const onKeyDown = (event) => {
      if (event.repeat) {
        if (SWALLOWED.has(event.code)) { event.preventDefault(); }
        return;
      }
      const action = KEY_MAP[event.code];
      if (action) {
        this.keyHeld.add(action);
        if (action === 'action') { this.actionPressed = true; }
      }
      if (event.code === 'Space' || event.code === 'Enter') { this.startPressed = true; }
      if (event.code === 'KeyP' || event.code === 'Escape') { this.pausePressed = true; }
      if (event.code === 'KeyM') { this.mutePressed = true; }
      if (SWALLOWED.has(event.code)) { event.preventDefault(); }
      this.anyInputSeen = true;
    };

    const onKeyUp = (event) => {
      const action = KEY_MAP[event.code];
      if (action) { this.keyHeld.delete(action); }
    };

    const onBlur = () => {
      this.keyHeld.clear();
      this.pointerZones.clear();
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const onPointerDown = (event) => {
      if (event.pointerType !== 'mouse') { this.touchActive = true; }
      this.anyInputSeen = true;
      this.startPressed = true;

      const zone = this.zoneAt(event.clientX, event.clientY);
      if (zone) {
        this.pointerZones.set(event.pointerId, zone);
        if (zone === 'action') { this.actionPressed = true; }
        this.canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
    };

    const onPointerMove = (event) => {
      if (!this.pointerZones.has(event.pointerId)) { return; }
      const zone = this.zoneAt(event.clientX, event.clientY);
      if (zone) {
        this.pointerZones.set(event.pointerId, zone);
      } else {
        this.pointerZones.delete(event.pointerId);
      }
    };

    const onPointerUp = (event) => {
      this.pointerZones.delete(event.pointerId);
    };

    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  zoneAt(clientX, clientY) {
    const { x, y } = this.toLogical(clientX, clientY);
    for (const [name, zone] of Object.entries(TOUCH_ZONES)) {
      const dx = x - zone.x;
      const dy = y - zone.y;
      // A generous hit radius: fingers are bigger than the drawn circle.
      if (dx * dx + dy * dy <= (zone.radius * 1.35) ** 2) { return name; }
    }
    return null;
  }

  /**
   * Snapshot this frame's intent and clear the one-shot edges. Call exactly
   * once per frame.
   */
  consume() {
    const zones = new Set(this.pointerZones.values());
    const state = {
      up: this.keyHeld.has('up') || zones.has('up'),
      down: this.keyHeld.has('down') || zones.has('down'),
      left: this.keyHeld.has('left') || zones.has('left'),
      right: this.keyHeld.has('right') || zones.has('right'),
      action: this.keyHeld.has('action') || zones.has('action'),
      actionPressed: this.actionPressed,
      startPressed: this.startPressed,
      pausePressed: this.pausePressed,
      mutePressed: this.mutePressed,
    };

    this.actionPressed = false;
    this.startPressed = false;
    this.pausePressed = false;
    this.mutePressed = false;
    return state;
  }
}

export const NEUTRAL_INPUT = {
  up: false,
  down: false,
  left: false,
  right: false,
  action: false,
  actionPressed: false,
  startPressed: false,
  pausePressed: false,
  mutePressed: false,
};
