import { SCORING, BARREL, STORAGE_KEYS } from './config.js';
import { clamp } from './util/math.js';
import { read, readNumber, write } from './util/storage.js';

const SPIN_NAMES = ['AIR', '360 SPIN', '720 DOUBLE', '1080 TRIPLE', '1440 QUAD'];

/**
 * Turn a landing into a name and a point value.
 * Returns null for the little hops that aren't worth a callout.
 */
export function describeTrick(landing) {
  if (!landing.clean) { return null; }

  const { rotations, airTime, grabTime } = landing;
  const grabbed = grabTime >= 0.25;

  if (rotations === 0 && airTime < SCORING.minAirTimeForPoints && !grabbed) {
    return null;
  }

  let name = rotations < SPIN_NAMES.length
    ? SPIN_NAMES[rotations]
    : 'MEGA SPIN';

  if (rotations === 0 && airTime > 0.85) { name = 'BIG AIR'; }
  if (grabbed) { name += ' + GRAB'; }

  const spinPoints = rotations < SCORING.spin.length
    ? SCORING.spin[rotations]
    : SCORING.spin[SCORING.spin.length - 1] + (rotations - SCORING.spin.length + 1) * SCORING.spinOverflow;

  const points = Math.round(
    spinPoints +
    SCORING.air * airTime +
    SCORING.grabPerSecond * grabTime,
  );

  return { name, points, rotations, grabbed };
}

export class Scoreboard {
  constructor() {
    this.highScore = readNumber(STORAGE_KEYS.highScore, 0);
    this.bestTrick = read(STORAGE_KEYS.bestTrick, '') || '';
    this.reset();
  }

  reset() {
    this.distance = 0;
    this.trickScore = 0;
    this.barrelScore = 0;
    this.landedTricks = 0;
    this.bestTrickThisRun = '';
    this.bestTrickPoints = 0;
    this.barrelTime = 0;
    this.beatHighScore = false;
    // The number this run is chasing. Held separately from `highScore`, which
    // creeps up live as you play past it.
    this.chasing = this.highScore;
  }

  get multiplier() {
    return clamp(1 + this.landedTricks * SCORING.comboStep, 1, SCORING.comboMax);
  }

  get total() {
    return this.distancePoints + this.trickScore + this.barrelScore;
  }

  get distancePoints() {
    return Math.floor(this.distance * SCORING.pointsPerPixel);
  }

  /**
   * Where the run's points came from, for the results panel. Seeing the split
   * is what tells you whether to chase distance, tricks or barrels next time.
   */
  breakdown() {
    return {
      distancePoints: this.distancePoints,
      // The wave face is roughly 3m of water per 100px, which makes the
      // distance read as a surfable ride rather than a pixel count.
      metres: this.distance * 0.03,
      trickScore: this.trickScore,
      landedTricks: this.landedTricks,
      bestTrick: this.bestTrickThisRun,
      barrelScore: this.barrelScore,
      barrelTime: this.barrelTime,
    };
  }

  addDistance(pixels) {
    this.distance += pixels;
    this.checkHighScore();
  }

  /** @returns {null | { name: string, points: number, multiplier: number }} */
  landTrick(landing) {
    const trick = describeTrick(landing);
    if (!trick) { return null; }

    const multiplier = this.multiplier;
    const points = Math.round(trick.points * multiplier);
    this.trickScore += points;
    this.landedTricks += 1;

    if (points > this.bestTrickPoints) {
      this.bestTrickPoints = points;
      this.bestTrickThisRun = trick.name;
    }

    this.checkHighScore();
    return { name: trick.name, points, multiplier };
  }

  addNearMiss() {
    this.trickScore += Math.round(SCORING.nearMiss * this.multiplier);
    this.checkHighScore();
  }

  addBarrelTime(dt, pocketDepth) {
    this.barrelTime += dt;
    this.barrelScore += Math.round(
      (BARREL.scorePerSecond + BARREL.pocketBonusPerSecond * pocketDepth) * dt,
    );
    this.checkHighScore();
  }

  /** @returns true the moment this run overtakes the previous best. */
  checkHighScore() {
    if (this.total <= this.highScore) { return false; }
    this.highScore = this.total;

    // Nothing to beat on a first run — that is a personal best by default,
    // not an achievement worth a fanfare.
    if (this.chasing > 0 && !this.beatHighScore) {
      this.beatHighScore = true;
      return true;
    }
    return false;
  }

  /** Called once when a run ends, to persist anything worth keeping. */
  commit() {
    this.checkHighScore();
    write(STORAGE_KEYS.highScore, this.highScore);
    if (this.bestTrickThisRun && this.bestTrickPoints > 0) {
      this.bestTrick = this.bestTrickThisRun;
      write(STORAGE_KEYS.bestTrick, this.bestTrick);
    }
  }
}
