import { PALETTE } from '../config.js';
import { clamp, lerp } from '../util/math.js';
import { MODE } from '../surfer.js';

const BOARD_COLOR = '#ffd166';
const BOARD_STRIPE = '#ff6b5e';
const SUIT = '#16324f';
const SUIT_PANEL = '#2ec4b6';
const SKIN = '#f0c199';
const HAIR = '#3a2416';

function ink(ctx, width = 2.8) {
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

function fillStroke(ctx, color, width = 2.8) {
  ctx.fillStyle = color;
  ctx.fill();
  ink(ctx, width);
  ctx.stroke();
}

function drawBoard(ctx) {
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.quadraticCurveTo(8, -8.5, -20, -6.5);
  ctx.quadraticCurveTo(-31, -5.5, -31, 0);
  ctx.quadraticCurveTo(-31, 5.5, -20, 6.5);
  ctx.quadraticCurveTo(8, 8.5, 34, 0);
  ctx.closePath();
  fillStroke(ctx, BOARD_COLOR, 2.8);

  // Stringer and a stripe, so rotation reads clearly mid-spin.
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-28, 0);
  ctx.strokeStyle = 'rgba(10, 43, 56, 0.3)';
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.quadraticCurveTo(8, -8.5, -20, -6.5);
  ctx.quadraticCurveTo(-31, -5.5, -31, 0);
  ctx.quadraticCurveTo(-31, 5.5, -20, 6.5);
  ctx.quadraticCurveTo(8, 8.5, 34, 0);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = BOARD_STRIPE;
  ctx.fillRect(-10, -10, 7, 20);
  ctx.fillRect(6, -10, 4, 20);
  ctx.restore();
}

function drawFin(ctx) {
  ctx.beginPath();
  ctx.moveTo(-22, 4);
  ctx.quadraticCurveTo(-24, 15, -30, 15);
  ctx.lineTo(-25, 4);
  ctx.closePath();
  fillStroke(ctx, BOARD_STRIPE, 2.2);
}

/**
 * The rider, posed from a few inputs:
 *  - `crouch` 0..1 pulls the hips down (speed, landing compression, grabs)
 *  - `lean`  -1..1 shifts weight back (climbing) or forward (dropping)
 *  - `grabbing` sends the front hand to the rail
 */
function drawRider(ctx, { crouch, lean, grabbing, flail }) {
  const hipY = lerp(-32, -20, crouch);
  const hipX = lerp(1, -3, clamp(lean, 0, 1)) + lerp(0, 3, clamp(-lean, 0, 1));
  const shoulderY = hipY - 13;
  const shoulderX = hipX + 3;
  const headY = shoulderY - 8.5;

  // Legs: back foot over the fin, front foot forward of centre.
  ink(ctx, 5.6);
  ctx.strokeStyle = SUIT;
  ctx.beginPath();
  ctx.moveTo(-11, -5);
  ctx.quadraticCurveTo(-10, hipY + 8, hipX, hipY);
  ctx.moveTo(13, -6);
  ctx.quadraticCurveTo(11, hipY + 9, hipX, hipY);
  ctx.stroke();
  ink(ctx, 1.6);
  ctx.stroke();

  // Torso.
  ctx.beginPath();
  ctx.moveTo(hipX - 5, hipY + 2);
  ctx.quadraticCurveTo(hipX - 7, shoulderY, shoulderX - 5, shoulderY - 2);
  ctx.lineTo(shoulderX + 5, shoulderY - 1);
  ctx.quadraticCurveTo(hipX + 7, shoulderY, hipX + 6, hipY + 2);
  ctx.closePath();
  fillStroke(ctx, SUIT, 2.4);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(hipX - 5, hipY + 2);
  ctx.quadraticCurveTo(hipX - 7, shoulderY, shoulderX - 5, shoulderY - 2);
  ctx.lineTo(shoulderX + 5, shoulderY - 1);
  ctx.quadraticCurveTo(hipX + 7, shoulderY, hipX + 6, hipY + 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = SUIT_PANEL;
  ctx.fillRect(hipX - 8, shoulderY + 4, 18, 4.5);
  ctx.restore();

  // Arms.
  ink(ctx, 4.2);
  ctx.strokeStyle = SKIN;
  ctx.beginPath();
  if (grabbing) {
    ctx.moveTo(shoulderX + 2, shoulderY);
    ctx.quadraticCurveTo(16, shoulderY + 8, 14, -6);
    ctx.moveTo(shoulderX - 3, shoulderY + 1);
    ctx.quadraticCurveTo(-14, shoulderY - 6, -20, shoulderY - 12);
  } else {
    ctx.moveTo(shoulderX + 2, shoulderY);
    ctx.quadraticCurveTo(16, shoulderY - 4, 24, shoulderY - 10 + flail * 4);
    ctx.moveTo(shoulderX - 3, shoulderY + 1);
    ctx.quadraticCurveTo(-13, shoulderY - 2, -21, shoulderY - 8 - flail * 4);
  }
  ctx.stroke();
  ink(ctx, 1.5);
  ctx.stroke();

  // Head, with hair blown back.
  ctx.beginPath();
  ctx.arc(shoulderX + 1, headY, 7.4, 0, Math.PI * 2);
  fillStroke(ctx, SKIN, 2.4);

  ctx.beginPath();
  ctx.arc(shoulderX + 1, headY, 7.4, Math.PI * 1.02, Math.PI * 2.02);
  ctx.quadraticCurveTo(shoulderX - 9, headY - 5, shoulderX - 12, headY - 1);
  ctx.quadraticCurveTo(shoulderX - 7, headY - 1, shoulderX - 6, headY + 1);
  ctx.closePath();
  ctx.fillStyle = HAIR;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(shoulderX + 5, headY + 0.5, 1.3, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.ink;
  ctx.fill();
}

/**
 * @param {import('../surfer.js').Surfer} surfer
 */
export function drawSurfer(ctx, surfer, wave, time) {
  const riding = surfer.mode === MODE.riding;
  const angle = riding
    ? wave.slopeAt(surfer.x, surfer.h) + clamp(-surfer.vh * 0.22, -0.3, 0.3)
    : surfer.spin;

  // Shadow on the face, only while there's water underneath.
  if (riding) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#031f2b';
    ctx.beginPath();
    ctx.ellipse(surfer.x + 4, surfer.y + 10, 30, 6, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const squash = surfer.landingSquash;
  const crouch = clamp(
    (riding ? 0.25 : 0.15) + squash * 0.8 + (surfer.grabbing ? 0.55 : 0),
    0,
    1,
  );

  ctx.save();
  ctx.translate(surfer.x, surfer.y + 6);
  ctx.rotate(angle);
  ctx.scale(1 + squash * 0.12, 1 - squash * 0.16);

  drawFin(ctx);
  drawBoard(ctx);
  drawRider(ctx, {
    crouch,
    lean: riding ? clamp(surfer.vh * 1.6, -1, 1) : 0.2,
    grabbing: surfer.grabbing,
    flail: surfer.mode === MODE.wipeout ? Math.sin(time * 22) : Math.sin(time * 4) * 0.5,
  });

  ctx.restore();
}

/**
 * A compass showing board rotation while airborne, with the green window you
 * need to be inside when you touch back down. This is the whole trick system
 * made legible in one little dial.
 */
export function drawRotationDial(ctx, surfer, tolerance) {
  if (surfer.mode !== MODE.air || surfer.airTime < 0.12) { return; }

  const radius = 19;
  const angle = Math.atan2(Math.sin(surfer.spin), Math.cos(surfer.spin));
  const safe = Math.abs(angle) <= tolerance;
  const colour = safe ? '#8effc0' : PALETTE.danger;

  ctx.save();
  ctx.translate(surfer.x + 62, surfer.y - 44);
  ctx.globalAlpha = clamp(surfer.airTime / 0.25, 0, 1) * 0.95;

  // The window you have to land inside, drawn as an arc on the rim.
  ctx.beginPath();
  ctx.arc(0, 0, radius, -tolerance, tolerance);
  ctx.strokeStyle = safe ? 'rgba(142, 255, 192, 0.95)' : 'rgba(142, 255, 192, 0.4)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'butt';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(233, 251, 255, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Needle: a tiny board pointing wherever the real one is pointing.
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(-radius + 6, 0);
  ctx.lineTo(radius - 7, 0);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(radius - 8, -3.4);
  ctx.lineTo(radius - 1, 0);
  ctx.lineTo(radius - 8, 3.4);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();

  ctx.restore();
  ctx.globalAlpha = 1;
}
