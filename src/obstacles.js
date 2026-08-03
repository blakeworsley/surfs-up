import { VIEW, WAVE, DIFFICULTY } from './config.js';
import { clamp, lerp, rectsOverlap } from './util/math.js';

/** Nominal face height in pixels, used to convert hitboxes into `h` units. */
export const FACE_SPAN = WAVE.troughBase - WAVE.crestBase;

/**
 * Everyone else out in the water. Each entry declares where on the face they
 * sit, how big they are, and when in the run they start showing up.
 *
 * `band` is the range of face heights the spawner may drop them into.
 */
export const OBSTACLE_TYPES = [
  {
    id: 'swimmer',
    blame: 'You ran straight over a swimmer.',
    label: 'Swimmer',
    shout: 'AAAH!',
    width: 34,
    height: 30,
    band: [0.04, 0.26],
    weight: 22,
    from: 0,
    motion: 'bob',
  },
  {
    id: 'kook',
    blame: 'A kook snaked you. Classic.',
    label: 'Kook',
    shout: 'SORRY!',
    width: 46,
    height: 44,
    band: [0.14, 0.56],
    weight: 26,
    from: 0,
    motion: 'wobble',
  },
  {
    id: 'bodyboarder',
    blame: 'You clipped a bodyboarder.',
    label: 'Bodyboarder',
    shout: 'WHOA!',
    width: 48,
    height: 32,
    band: [0.18, 0.6],
    weight: 18,
    from: 0,
    motion: 'bob',
  },
  {
    id: 'longboarder',
    blame: 'The longboarder was not stoked.',
    label: 'Longboarder',
    shout: 'MY WAVE!',
    width: 76,
    height: 40,
    band: [0.28, 0.72],
    weight: 15,
    from: 0.12,
    motion: 'glide',
  },
  {
    id: 'paddler',
    blame: 'Someone paddled right into your line.',
    label: 'Paddler',
    shout: 'PADDLE!',
    width: 48,
    height: 36,
    band: [0.1, 0.34],
    weight: 15,
    from: 0.24,
    motion: 'climb',
  },
  {
    id: 'sup',
    blame: 'You took out a stand-up paddler.',
    label: 'SUP',
    shout: 'HEY!',
    width: 42,
    height: 82,
    band: [0.3, 0.58],
    weight: 11,
    from: 0.42,
    motion: 'sway',
  },
];

export const SEAGULL = {
  id: 'seagull',
  blame: 'You caught a seagull mid-air.',
  label: 'Seagull',
  shout: 'SQUAWK!',
  width: 42,
  height: 26,
  weight: 1,
  motion: 'fly',
};

/** An obstacle's vertical footprint in `h` units, padded by `clearance`. */
export function bandOf(obstacle, clearance = 0) {
  const half = obstacle.height / FACE_SPAN / 2;
  return [obstacle.h - half - clearance, obstacle.h + half + clearance];
}

/**
 * The largest run of face height not covered by any of `bands`.
 * If this ever collapses the player has nowhere to go, so the spawner uses it
 * to veto placements that would wall the wave off.
 */
export function freeCorridor(bands) {
  const sorted = bands
    .map(([low, high]) => [clamp(low, 0, 1), clamp(high, 0, 1)])
    .filter(([low, high]) => high > low)
    .sort((a, b) => a[0] - b[0]);

  let widest = 0;
  let cursor = 0;
  for (const [low, high] of sorted) {
    if (low > cursor) { widest = Math.max(widest, low - cursor); }
    cursor = Math.max(cursor, high);
  }
  return Math.max(widest, 1 - cursor);
}

export class Obstacle {
  constructor(type, x, h, variant = 0) {
    this.type = type;
    this.id = type.id;
    this.x = x;
    this.h = h;
    this.baseH = h;
    this.width = type.width;
    this.height = type.height;
    // Which person this is: drives skin tone, wetsuit and board colour.
    this.variant = variant;
    this.phase = 0;
    this.y = 0;
    this.passed = false;
  }

  bounds() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
  }

  update(dt, worldSpeed, wave) {
    this.x -= worldSpeed * dt;
    this.phase += dt;

    switch (this.type.motion) {
      case 'bob':
        this.h = this.baseH + Math.sin(this.phase * 3.1) * 0.012;
        break;
      case 'wobble':
        this.h = this.baseH + Math.sin(this.phase * 5.4) * 0.02;
        break;
      case 'sway':
        this.h = this.baseH + Math.sin(this.phase * 1.9) * 0.01;
        break;
      case 'climb':
        // Paddling up the face — the one obstacle that moves into your line.
        this.h = Math.min(0.86, this.baseH + this.phase * 0.16);
        break;
      case 'fly':
        this.h = this.baseH;
        this.airY += Math.sin(this.phase * 2.2) * 14 * dt;
        break;
      default:
        break;
    }

    this.y = this.type.motion === 'fly'
      ? this.airY
      : wave.yAt(this.x, this.h);
  }

  get offScreen() {
    return this.x + this.width < -40;
  }
}

export class Seagull extends Obstacle {
  constructor(x, airY) {
    super(SEAGULL, x, 1, 0);
    this.airY = airY;
    this.flapPhase = 0;
  }

  update(dt, worldSpeed, wave) {
    this.flapPhase += dt * 11;
    super.update(dt, worldSpeed * 0.82, wave);
  }
}

/**
 * Spawns and drives every obstacle on screen, and enforces the two fairness
 * rules that keep the game honest:
 *
 *  1. Nothing spawns so close behind another obstacle that you couldn't react.
 *  2. No cluster may cover the whole face — there is always a corridor.
 */
export class ObstacleField {
  constructor(rng) {
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.items = [];
    // A beat of clear water so a run never opens with an ambush.
    this.timer = 1.5;
  }

  availableTypes(difficulty) {
    return OBSTACLE_TYPES.filter((type) => difficulty >= type.from);
  }

  update(dt, worldSpeed, wave, difficulty, distance) {
    for (const item of this.items) {
      item.update(dt, worldSpeed, wave);
    }
    this.items = this.items.filter((item) => !item.offScreen);

    // No traffic inside a barrel — the reward section stays clean.
    if (wave.inBarrel) { return; }

    this.timer -= dt;
    if (this.timer > 0) { return; }

    const gap = lerp(DIFFICULTY.spawnGapEasy, DIFFICULTY.spawnGapHard, difficulty);
    const jitter = 1 + this.rng.range(-DIFFICULTY.spawnJitter, DIFFICULTY.spawnJitter);
    this.timer = gap * jitter;

    if (distance > DIFFICULTY.seagullsAfter && this.rng.chance(0.18)) {
      this.spawnSeagull(wave);
      return;
    }

    this.trySpawn(worldSpeed, difficulty);

    // Later on, occasionally follow up with a second body to thread between.
    if (difficulty > 0.3 && this.rng.chance(0.16 + difficulty * 0.2)) {
      this.trySpawn(worldSpeed, difficulty, this.rng.range(120, 210));
    }
  }

  trySpawn(worldSpeed, difficulty, offset = 0) {
    const spawnX = VIEW.width + 90 + offset;
    const types = this.availableTypes(difficulty);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const type = this.rng.weighted(types);
      const h = this.rng.range(type.band[0], type.band[1]);
      const candidate = new Obstacle(type, spawnX, h, this.rng.int(0, 3));
      if (this.canPlace(candidate, worldSpeed)) {
        this.items.push(candidate);
        return candidate;
      }
    }
    return null;
  }

  spawnSeagull(wave) {
    const x = VIEW.width + 90;
    const airY = wave.crestAt(x) - this.rng.range(70, 210);
    const gull = new Seagull(x, airY);
    this.items.push(gull);
    return gull;
  }

  /** Rules 1 and 2 from the class comment. */
  canPlace(candidate, worldSpeed) {
    const reactionGap = worldSpeed * DIFFICULTY.minReactionSeconds;
    const clusterWindow = Math.max(reactionGap, 200);
    const neighbours = [];

    for (const item of this.items) {
      if (item.id === 'seagull') { continue; }
      const dx = Math.abs(item.x - candidate.x);
      if (dx < 74) { return false; }
      if (dx < clusterWindow) { neighbours.push(item); }
    }

    if (neighbours.length === 0) { return true; }

    const bands = [...neighbours, candidate].map((item) => bandOf(item, 0.07));
    return freeCorridor(bands) >= 0.26;
  }

  /** The first obstacle overlapping `box`, or null. Air and face are separate. */
  collide(box, airborne) {
    for (const item of this.items) {
      const isGull = item.id === 'seagull';
      if (isGull !== airborne) { continue; }
      if (rectsOverlap(box, item.bounds())) { return item; }
    }
    return null;
  }

  /**
   * Obstacles that have just slipped behind the surfer. Returns the ones that
   * went by close enough to be worth a shout.
   */
  collectNearMisses(surfer, threshold = 52) {
    const close = [];
    for (const item of this.items) {
      if (item.passed || item.x > surfer.x) { continue; }
      item.passed = true;
      const gap = Math.abs(item.y - surfer.y) - (item.height + 40) / 2;
      if (gap < threshold) {
        close.push(item);
      }
    }
    return close;
  }
}
