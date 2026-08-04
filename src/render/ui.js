import { PALETTE } from '../config.js';
import { clamp } from '../util/math.js';

/**
 * Shared drawing primitives for the interface.
 *
 * Everything on screen — the HUD, the overlays, the touch buttons — is built
 * from these, so a change to the panel treatment or the type scale lands
 * everywhere at once instead of in five slightly different places.
 */

export const UI_FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
export const DISPLAY_FONT = '"Righteous", "Baloo 2", "Trebuchet MS", system-ui, sans-serif';

// --- Easing ----------------------------------------------------------------

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInCubic = (t) => t * t * t;

/** Overshoots slightly before settling — good for things that should land. */
export function easeOutBack(t, overshoot = 1.5) {
  const c = overshoot + 1;
  return 1 + c * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/** A 0..1 ramp for something that started `elapsed` seconds ago. */
export function intro(elapsed, delay, duration = 0.34) {
  return clamp((elapsed - delay) / duration, 0, 1);
}

// --- Shapes ----------------------------------------------------------------

export function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

export function panel(ctx, x, y, width, height, { radius = 22, alpha = 0.74, glow = true } = {}) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 10;
  }
  roundRect(ctx, x, y, width, height, radius);
  const fill = ctx.createLinearGradient(0, y, 0, y + height);
  fill.addColorStop(0, `rgba(8, 46, 62, ${alpha})`);
  fill.addColorStop(1, `rgba(3, 27, 39, ${alpha})`);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = 'rgba(174, 236, 249, 0.38)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // A hairline of light along the top edge, so panels read as lit from above.
  ctx.save();
  roundRect(ctx, x, y, width, height, radius);
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + radius * 0.6, y + 1);
  ctx.lineTo(x + width - radius * 0.6, y + 1);
  ctx.stroke();
  ctx.restore();
}

export function text(ctx, value, x, y, {
  size = 24,
  color = PALETTE.hud,
  weight = '700',
  align = 'left',
  font = UI_FONT,
  outline = 0,
  shadow = 0,
  letterSpacing = null,
} = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (letterSpacing !== null && 'letterSpacing' in ctx) {
    ctx.letterSpacing = `${letterSpacing}px`;
  }
  if (shadow) {
    ctx.shadowColor = 'rgba(2, 20, 30, 0.55)';
    ctx.shadowBlur = shadow;
    ctx.shadowOffsetY = shadow * 0.28;
  }
  if (outline) {
    ctx.lineWidth = outline;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4, 33, 46, 0.88)';
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

export function keyCap(ctx, x, y, label, { width = 42, height = 34, active = false } = {}) {
  // A touch of depth: the cap sits on a darker shadow that shrinks when held.
  const drop = active ? 1 : 3;
  roundRect(ctx, x, y + drop, width, height, 9);
  ctx.fillStyle = 'rgba(2, 22, 32, 0.55)';
  ctx.fill();

  roundRect(ctx, x, y, width, height - (active ? 2 : 0), 9);
  ctx.fillStyle = active ? 'rgba(126, 231, 255, 0.92)' : 'rgba(246, 254, 255, 0.15)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(246, 254, 255, 0.62)';
  ctx.lineWidth = 2;
  ctx.stroke();

  text(ctx, label, x + width / 2, y + height / 2 + 6 - (active ? 2 : 0), {
    size: label.length > 2 ? 15 : 18,
    align: 'center',
    color: active ? '#052a38' : PALETTE.hud,
  });
}

/**
 * A rounded progress bar with tick marks. `glowAt` makes it light up once the
 * value passes a threshold, which is what turns a readout into a signal.
 */
export function meter(ctx, x, y, width, height, value, {
  color = '#7ee7ff',
  hot = PALETTE.gold,
  glowAt = 0.82,
  ticks = 4,
} = {}) {
  const filled = clamp(value, 0, 1);
  const isHot = filled >= glowAt;

  roundRect(ctx, x, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(3, 26, 38, 0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(174, 236, 249, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (filled > 0.01) {
    ctx.save();
    if (isHot) {
      ctx.shadowColor = 'rgba(255, 212, 101, 0.9)';
      ctx.shadowBlur = 10;
    }
    roundRect(ctx, x, y, Math.max(height, width * filled), height, height / 2);
    ctx.fillStyle = isHot ? hot : color;
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  roundRect(ctx, x, y, width, height, height / 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(3, 26, 38, 0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < ticks; i += 1) {
    const tx = x + (width * i) / ticks;
    ctx.beginPath();
    ctx.moveTo(tx, y);
    ctx.lineTo(tx, y + height);
    ctx.stroke();
  }
  ctx.restore();
}

/** A pill with a label — used for the combo multiplier and small stats. */
export function chip(ctx, x, y, label, {
  color = PALETTE.gold,
  size = 20,
  padding = 12,
  align = 'left',
} = {}) {
  ctx.font = `800 ${size}px ${UI_FONT}`;
  const width = ctx.measureText(label).width + padding * 2;
  const height = size + 12;
  const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;

  roundRect(ctx, left, y, width, height, height / 2);
  ctx.fillStyle = 'rgba(4, 33, 46, 0.72)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;

  text(ctx, label, left + width / 2, y + height - 9, { size, align: 'center', color, weight: '800' });
  return { width, height };
}

/** Hand-drawn speaker; emoji render inconsistently across platforms. */
export function speakerIcon(ctx, x, y, muted, { scale = 1, alpha = 0.75 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = PALETTE.hud;
  ctx.fillStyle = PALETTE.hud;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.lineTo(-4, -4);
  ctx.lineTo(2, -10);
  ctx.lineTo(2, 10);
  ctx.lineTo(-4, 4);
  ctx.lineTo(-9, 4);
  ctx.closePath();
  ctx.fill();

  if (muted) {
    ctx.strokeStyle = PALETTE.danger;
    ctx.beginPath();
    ctx.moveTo(6, -6);
    ctx.lineTo(14, 6);
    ctx.moveTo(14, -6);
    ctx.lineTo(6, 6);
    ctx.stroke();
  } else {
    for (let i = 1; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(2, 0, 4 + i * 4, -0.9, 0.9);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A ring that drains clockwise — used for the barrel section timer. */
export function timerRing(ctx, x, y, radius, remaining, { color = PALETTE.gold } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(4, 33, 46, 0.6)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(remaining, 0, 1));
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}
