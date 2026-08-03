import { VIEW } from './config.js';
import { Game, STATE } from './game.js';
import { Input } from './input.js';

const canvas = document.getElementById('surf');
const ctx = canvas.getContext('2d', { alpha: false });

const input = new Input(canvas, toLogical);
const game = new Game();

function toLogical(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * VIEW.width,
    y: ((clientY - rect.top) / rect.height) * VIEW.height,
  };
}

/**
 * Match the backing store to the display size so the canvas is sharp on
 * retina screens, then scale the context back into logical coordinates.
 */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(width / VIEW.width, 0, 0, height / VIEW.height, 0, 0);
}

window.addEventListener('resize', resize);
if (window.ResizeObserver) {
  new ResizeObserver(resize).observe(canvas);
}

// Audio contexts can only be created inside a user gesture.
const unlockAudio = () => game.audio.unlock();
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('pointerdown', unlockAudio, { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === STATE.playing) {
    game.state = STATE.paused;
  }
});

let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  resize();
  game.showTouch = input.touchActive;
  game.update(dt, input.consume());
  game.render(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Handy for poking at the game from the console.
window.surfsUp = game;
