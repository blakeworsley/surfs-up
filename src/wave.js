import { WAVE, BARREL } from './config.js';
import { clamp, lerp, ratio, sineSum, smoothstep } from './util/math.js';

/**
 * The wave is two scrolling curves: the crest (the lip you launch off) and the
 * trough (where the face flattens into the shoulder). Everything in between is
 * rideable, addressed by a normalised height `h` where 0 = trough, 1 = lip.
 *
 * `scroll` advances with the surfer's forward speed, so the whole wave moves
 * beneath the player while their screen x stays put.
 */
export class Wave {
  constructor() {
    this.scroll = 0;
    /** @type {null | { elapsed: number, duration: number }} */
    this.barrel = null;
    this.nextBarrelAt = Infinity;
  }

  advance(distance) {
    this.scroll += distance * WAVE.scrollRate;
  }

  crestAt(x) {
    return WAVE.crestBase + sineSum(WAVE.crestWaves, x + this.scroll);
  }

  troughAt(x) {
    return WAVE.troughBase + sineSum(WAVE.troughWaves, x + this.scroll);
  }

  /** Screen y for a point at height `h` above the trough at column `x`. */
  yAt(x, h) {
    const trough = this.troughAt(x);
    const crest = this.crestAt(x);
    return lerp(trough, crest, h);
  }

  /** Turn a screen y back into a face height. The inverse of `yAt`. */
  heightAt(x, y) {
    const trough = this.troughAt(x);
    const crest = this.crestAt(x);
    if (trough === crest) { return 0; }
    return (y - trough) / (crest - trough);
  }

  /**
   * The angle of the wave surface at a point, so boards and bodies can sit
   * flush against it instead of floating at a fixed tilt.
   */
  slopeAt(x, h, sample = 14) {
    const ahead = this.yAt(x + sample, h);
    const behind = this.yAt(x - sample, h);
    return Math.atan2(ahead - behind, sample * 2);
  }

  // --- Barrel sections -----------------------------------------------------

  get inBarrel() {
    return this.barrel !== null;
  }

  startBarrel(duration = BARREL.duration) {
    this.barrel = { elapsed: 0, duration };
  }

  updateBarrel(dt) {
    if (!this.barrel) { return; }
    this.barrel.elapsed += dt;
    if (this.barrel.elapsed >= this.barrel.duration) {
      this.barrel = null;
    }
  }

  /**
   * 0 while the lip is still throwing, 1 once it is fully pitched over, easing
   * back to 0 as the section closes out. Drives both the visuals and how hard
   * the falling lip pushes the surfer down.
   */
  barrelIntensity() {
    if (!this.barrel) { return 0; }
    const { elapsed, duration } = this.barrel;
    const opening = smoothstep(0, 0.75, elapsed);
    const closing = 1 - smoothstep(duration - 0.85, duration, elapsed);
    return clamp(Math.min(opening, closing), 0, 1);
  }

  /** True when the surfer is tucked inside the tube and racking up score. */
  inPocket(h) {
    return this.inBarrel && h >= BARREL.pocketLow && h <= BARREL.pocketHigh;
  }

  /** How deep in the pocket, 0..1, for scaling the bonus and the audio. */
  pocketDepth(h) {
    if (!this.inBarrel) { return 0; }
    const mid = (BARREL.pocketLow + BARREL.pocketHigh) / 2;
    const half = (BARREL.pocketHigh - BARREL.pocketLow) / 2;
    return 1 - ratio(Math.abs(h - mid), 0, half);
  }
}
