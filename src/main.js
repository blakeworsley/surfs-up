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
const stage = document.querySelector('.stage');
const frameEl = document.querySelector('.frame');

/**
 * Fit the 16:9 frame inside the viewport.
 *
 * CSS `aspect-ratio` on a `width: 100%` box is driven by width alone, so on a
 * short-and-wide viewport — a phone held sideways, a short desktop window —
 * the frame grows taller than the screen and the bottom of the game (which is
 * where the touch buttons live) gets cut off. Measuring both axes is the only
 * way to guarantee the whole playfield is on screen.
 */
function fitFrame() {
  const style = getComputedStyle(document.body);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);

  // Whatever else is stacked above and below the frame, plus the flex gaps.
  const siblings = [...stage.children].filter((el) => el !== frameEl && el.offsetParent !== null);
  const gap = parseFloat(getComputedStyle(stage).rowGap) || 0;
  const chrome = siblings.reduce((total, el) => total + el.offsetHeight, 0) + gap * siblings.length;

  const availableWidth = document.documentElement.clientWidth - padX;
  const availableHeight = document.documentElement.clientHeight - padY - chrome;
  const width = Math.max(240, Math.min(availableWidth, 1180, (availableHeight * VIEW.width) / VIEW.height));

  frameEl.style.width = `${Math.floor(width)}px`;
}

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

function relayout() {
  fitFrame();
  resize();
}

relayout();
window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', relayout);
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
