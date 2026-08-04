import { PALETTE } from '../config.js';

/**
 * Everyone you're dodging, drawn with paths instead of sprites.
 *
 * Each helper draws centred on (0, 0) with the surface of the water at y = 0,
 * so the caller only has to translate and rotate to the wave's slope.
 */

const SKIN = ['#f4c9a0', '#d79a68', '#8d5a3b', '#5c3a26'];
const SUITS = ['#1f3f66', '#2f6b5a', '#7a3350', '#3d3566'];
const BOARDS = ['#ffd166', '#ff8f5e', '#7ee0c8', '#f2f6ff', '#ff6b8b'];

function ink(ctx, width = 2.6) {
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function fillStroke(ctx, color, width = 2.6) {
  ctx.fillStyle = color;
  ctx.fill();
  ink(ctx, width);
  ctx.stroke();
}

function board(ctx, length, thickness, color) {
  const half = length / 2;
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.quadraticCurveTo(half * 0.2, -thickness, -half * 0.72, -thickness * 0.75);
  ctx.quadraticCurveTo(-half, -thickness * 0.6, -half, 0);
  ctx.quadraticCurveTo(-half, thickness * 0.6, -half * 0.72, thickness * 0.75);
  ctx.quadraticCurveTo(half * 0.2, thickness, half, 0);
  ctx.closePath();
  fillStroke(ctx, color);

  ctx.beginPath();
  ctx.moveTo(half * 0.75, 0);
  ctx.lineTo(-half * 0.8, 0);
  ctx.strokeStyle = 'rgba(10, 43, 56, 0.28)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function head(ctx, x, y, radius, skin, hair = '#2b1c14') {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  fillStroke(ctx, skin, 2.2);

  ctx.beginPath();
  ctx.arc(x, y, radius, Math.PI * 1.05, Math.PI * 2.05);
  ctx.lineTo(x, y - radius * 0.2);
  ctx.closePath();
  ctx.fillStyle = hair;
  ctx.fill();
}

function ripple(ctx, width, alpha = 0.6) {
  ctx.beginPath();
  ctx.ellipse(0, 3, width, width * 0.24, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(244, 254, 255, ${alpha})`;
  ctx.fill();
}

const DRAWERS = {
  swimmer(ctx, o, t) {
    const skin = SKIN[o.variant % SKIN.length];
    const flail = Math.sin(t * 7 + o.phase * 3);
    ripple(ctx, 20, 0.7);

    ink(ctx, 3);
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(-13, -9 + flail * 5);
    ctx.moveTo(4, 0);
    ctx.lineTo(13, -11 - flail * 5);
    ctx.strokeStyle = skin;
    ctx.lineWidth = 4.4;
    ctx.stroke();
    ink(ctx, 1.6);
    ctx.stroke();

    head(ctx, 0, -7, 7, skin, '#22160f');

    // Little panicked mouth.
    ctx.beginPath();
    ctx.arc(1.5, -5, 2, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.fill();
  },

  kook(ctx, o, t) {
    const skin = SKIN[(o.variant + 1) % SKIN.length];
    const suit = SUITS[o.variant % SUITS.length];
    const wobble = Math.sin(t * 6 + o.phase * 2) * 0.22;

    ripple(ctx, 26, 0.5);
    ctx.save();
    ctx.rotate(wobble);
    board(ctx, 54, 8, BOARDS[(o.variant + 3) % BOARDS.length]);

    // Squatting way too low, arms windmilling.
    ctx.beginPath();
    ctx.moveTo(-4, -7);
    ctx.lineTo(-6, -19);
    ctx.lineTo(6, -19);
    ctx.lineTo(6, -7);
    ctx.closePath();
    fillStroke(ctx, suit, 2.2);

    ink(ctx, 3.4);
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-5, -18);
    ctx.lineTo(-17, -27 - wobble * 20);
    ctx.moveTo(5, -18);
    ctx.lineTo(16, -25 + wobble * 20);
    ctx.stroke();

    head(ctx, 1, -26, 7, skin, '#3b2a1a');
    ctx.restore();
  },

  bodyboarder(ctx, o, t) {
    const skin = SKIN[(o.variant + 2) % SKIN.length];
    const kick = Math.sin(t * 9 + o.phase * 4) * 4;

    ripple(ctx, 24, 0.55);
    board(ctx, 40, 9, BOARDS[(o.variant + 1) % BOARDS.length]);

    ink(ctx, 3.6);
    ctx.strokeStyle = '#25384f';
    ctx.beginPath();
    ctx.moveTo(-14, -3);
    ctx.lineTo(-27, 1 + kick);
    ctx.moveTo(-14, 1);
    ctx.lineTo(-26, 5 - kick);
    ctx.stroke();

    // Flippers.
    ctx.fillStyle = '#f6b93b';
    ctx.beginPath();
    ctx.ellipse(-29, 1 + kick, 5, 2.6, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-28, 5 - kick, 5, 2.6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    head(ctx, 12, -10, 6.5, skin, '#1d1410');
  },

  longboarder(ctx, o, t) {
    const skin = SKIN[(o.variant + 3) % SKIN.length];
    const suit = SUITS[(o.variant + 2) % SUITS.length];
    const sway = Math.sin(t * 2.2 + o.phase) * 0.06;

    ripple(ctx, 40, 0.45);
    ctx.save();
    ctx.rotate(sway);
    board(ctx, 84, 8, BOARDS[(o.variant + 4) % BOARDS.length]);

    ctx.beginPath();
    ctx.moveTo(-3, -8);
    ctx.lineTo(-5, -24);
    ctx.lineTo(7, -24);
    ctx.lineTo(6, -8);
    ctx.closePath();
    fillStroke(ctx, suit, 2.2);

    // Classic cross-step, arms wide and casual.
    ink(ctx, 3.2);
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(-4, -22);
    ctx.lineTo(-20, -28);
    ctx.moveTo(6, -22);
    ctx.lineTo(21, -27);
    ctx.stroke();

    head(ctx, 2, -31, 7, skin, '#6b4a22');
    ctx.restore();
  },

  paddler(ctx, o, t) {
    const skin = SKIN[(o.variant + 1) % SKIN.length];
    const stroke = Math.sin(t * 6 + o.phase * 3);

    ripple(ctx, 28, 0.5);
    board(ctx, 62, 8, BOARDS[(o.variant + 2) % BOARDS.length]);

    ctx.beginPath();
    ctx.ellipse(-2, -8, 15, 6, 0, 0, Math.PI * 2);
    fillStroke(ctx, SUITS[(o.variant + 1) % SUITS.length], 2.2);

    ink(ctx, 3.2);
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(8, -9);
    ctx.lineTo(20, -4 + stroke * 6);
    ctx.moveTo(-10, -9);
    ctx.lineTo(-22, -2 - stroke * 6);
    ctx.stroke();

    head(ctx, 15, -14, 6.5, skin, '#2b1c14');
  },

  sup(ctx, o, t) {
    const skin = SKIN[(o.variant + 2) % SKIN.length];
    const suit = SUITS[(o.variant + 3) % SUITS.length];
    const sway = Math.sin(t * 1.6 + o.phase) * 0.05;

    ripple(ctx, 34, 0.45);
    ctx.save();
    ctx.rotate(sway);
    board(ctx, 70, 10, BOARDS[o.variant % BOARDS.length]);

    ctx.beginPath();
    ctx.moveTo(-5, -9);
    ctx.lineTo(-6, -44);
    ctx.lineTo(7, -44);
    ctx.lineTo(6, -9);
    ctx.closePath();
    fillStroke(ctx, suit, 2.4);

    // The paddle — the reason this one is so tall.
    ink(ctx, 3);
    ctx.strokeStyle = '#c9d6e2';
    ctx.beginPath();
    ctx.moveTo(20, -62);
    ctx.lineTo(10, -4);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(10, 0, 5, 8, 0.1, 0, Math.PI * 2);
    fillStroke(ctx, '#c9d6e2', 2);

    ink(ctx, 3.2);
    ctx.strokeStyle = skin;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(17, -55);
    ctx.moveTo(2, -30);
    ctx.lineTo(14, -34);
    ctx.stroke();

    head(ctx, 1, -52, 7.5, skin, '#1d1410');
    ctx.restore();
  },

  seagull(ctx, o, t) {
    const flap = Math.sin(o.flapPhase ?? t * 10);
    ctx.strokeStyle = '#fbfdff';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-18, flap * 5);
    ctx.quadraticCurveTo(-8, -8 - flap * 6, 0, 0);
    ctx.quadraticCurveTo(8, -8 - flap * 6, 18, flap * 5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(10,43,56,0.45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, 1, 7, 4.5, 0, 0, Math.PI * 2);
    fillStroke(ctx, '#ffffff', 2);

    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(12, 1.5);
    ctx.lineTo(6, 2.5);
    ctx.closePath();
    ctx.fillStyle = '#ffb347';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(3.5, -1, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.ink;
    ctx.fill();
  },
};

export function drawObstacle(ctx, obstacle, wave, time) {
  const drawer = DRAWERS[obstacle.id];
  if (!drawer) { return; }

  const isGull = obstacle.id === 'seagull';
  const angle = isGull ? 0 : wave.slopeAt(obstacle.x, obstacle.h);

  ctx.save();
  ctx.translate(obstacle.x, obstacle.y + (isGull ? 0 : obstacle.height / 2 - 4));
  ctx.rotate(angle);
  drawer(ctx, obstacle, time);
  ctx.restore();
}
