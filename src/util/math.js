export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  if (value < min) { return min; }
  if (value > max) { return max; }
  return value;
}

export function lerp(from, to, t) {
  return from + (to - from) * t;
}

/** Inverse lerp, clamped to 0..1. Useful for turning a range into a ratio. */
export function ratio(value, from, to) {
  if (from === to) { return 0; }
  return clamp((value - from) / (to - from), 0, 1);
}

/**
 * Frame-rate independent easing. `rate` is roughly "how many e-folds per
 * second", so bigger numbers snap harder.
 */
export function damp(from, to, rate, dt) {
  return lerp(from, to, 1 - Math.exp(-rate * dt));
}

/** Wrap an angle into -PI..PI. */
export function normalizeAngle(angle) {
  let a = (angle + Math.PI) % TAU;
  if (a < 0) { a += TAU; }
  return a - Math.PI;
}

/** How far an angle sits from "upright", ignoring how many full spins it did. */
export function offAxis(angle) {
  return Math.abs(normalizeAngle(angle));
}

/** Completed full rotations in an angle, rounded to the nearest whole spin. */
export function completedRotations(angle) {
  return Math.abs(Math.round(angle / TAU));
}

export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Sum of sine terms — used to give the wave lines an organic shape. */
export function sineSum(terms, x) {
  let total = 0;
  for (const term of terms) {
    total += term.amplitude * Math.sin(x * term.frequency + term.phase);
  }
  return total;
}

export function smoothstep(edge0, edge1, x) {
  const t = ratio(x, edge0, edge1);
  return t * t * (3 - 2 * t);
}
