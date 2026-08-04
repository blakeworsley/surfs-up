/**
 * A small seedable random number generator (mulberry32).
 *
 * The game seeds it from the clock, but tests can seed it with a fixed number
 * to get a repeatable run — which is what makes the obstacle spawner testable.
 */
export function createRng(seed = 1) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max]. */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /**
     * Pick from a list of `{ weight }` objects. Falls back to the last entry
     * if floating point drift leaves us short.
     */
    weighted(items, weightOf = (item) => item.weight) {
      let total = 0;
      for (const item of items) { total += weightOf(item); }
      let roll = next() * total;
      for (const item of items) {
        roll -= weightOf(item);
        if (roll <= 0) { return item; }
      }
      return items[items.length - 1];
    },
    chance(probability) {
      return next() < probability;
    },
  };
}
