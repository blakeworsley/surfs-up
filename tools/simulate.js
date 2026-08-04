#!/usr/bin/env node
/**
 * Balance harness.
 *
 * Plays the real game headless with a simple bot and reports how long runs
 * last, so difficulty can be tuned against numbers instead of vibes. The bot
 * is deliberately mediocre — it steers for the biggest gap and takes an air
 * whenever the coast is clear — so its scores should land in the range a
 * reasonably competent human would see.
 *
 *   node tools/simulate.js [runs]
 */
import { Game, STATE } from '../src/game.js';
import { VIEW } from '../src/config.js';

const RUNS = Number(process.argv[2] || 200);
const DT = 1 / 60;
const MAX_SECONDS = 400;

const NONE = {
  up: false, down: false, left: false, right: false, action: false,
  actionPressed: false, startPressed: false, pausePressed: false, mutePressed: false,
};

/** No audio in Node — swallow every call. */
const silentAudio = new Proxy({}, { get: () => () => {}, set: () => true });

function decide(game) {
  const { surfer, obstacles, wave } = game;
  const input = { ...NONE };

  if (surfer.mode === 'air') {
    // Spin for the first part of the air, then let go and let it settle —
    // the same rhythm a player uses.
    input.right = surfer.airTime < 0.7;
    return input;
  }

  const threats = obstacles.items.filter(
    (o) => o.id !== 'seagull' && o.x > surfer.x - 30 && o.x < surfer.x + VIEW.width * 0.55,
  );

  let target = 0.55;
  if (wave.inBarrel) {
    target = 0.72;
  } else if (threats.length) {
    const nearest = threats.reduce((a, b) => (a.x < b.x ? a : b));
    target = nearest.h > 0.5
      ? Math.max(0.06, nearest.h - 0.36)
      : Math.min(0.97, nearest.h + 0.36);
  } else if (surfer.h > 0.72) {
    // Clear water and already high: boost.
    input.actionPressed = true;
  }

  if (surfer.h < target - 0.03) { input.up = true; }
  if (surfer.h > target + 0.03) { input.down = true; }
  return input;
}

function playOne(seed) {
  const game = new Game({ audio: silentAudio, seed });
  game.start();

  let airs = 0;
  let tricks = 0;
  for (let t = 0; t < MAX_SECONDS && game.state === STATE.playing; t += DT) {
    const before = game.surfer.mode;
    game.update(DT, decide(game));
    if (before !== 'air' && game.surfer.mode === 'air') { airs += 1; }
    tricks = game.score.landedTricks;
  }

  return {
    score: game.score.total,
    seconds: game.score.distance / 420,
    distance: game.score.distance,
    difficulty: game.difficulty,
    reason: game.reason || '(survived)',
    airs,
    tricks,
    barrels: game.score.barrelTime,
  };
}

function quantile(sorted, q) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

const results = [];
for (let i = 0; i < RUNS; i += 1) { results.push(playOne(i * 7919 + 13)); }

const scores = results.map((r) => r.score).sort((a, b) => a - b);
const times = results.map((r) => r.seconds).sort((a, b) => a - b);
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

const causes = new Map();
for (const r of results) { causes.set(r.reason, (causes.get(r.reason) || 0) + 1); }

console.log(`\n  ${RUNS} bot runs\n`);
console.log(`  score    p10 ${quantile(scores, 0.1)}  median ${quantile(scores, 0.5)}  p90 ${quantile(scores, 0.9)}  max ${scores[scores.length - 1]}`);
console.log(`  seconds  p10 ${quantile(times, 0.1).toFixed(1)}  median ${quantile(times, 0.5).toFixed(1)}  p90 ${quantile(times, 0.9).toFixed(1)}`);
console.log(`  peak difficulty reached   ${mean(results.map((r) => r.difficulty)).toFixed(2)} average`);
console.log(`  airs ${mean(results.map((r) => r.airs)).toFixed(1)} per run · tricks landed ${mean(results.map((r) => r.tricks)).toFixed(1)} · barrel time ${mean(results.map((r) => r.barrels)).toFixed(1)}s\n`);
console.log('  what ended the run');
for (const [reason, count] of [...causes].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${String(Math.round((count / RUNS) * 100)).padStart(3)}%  ${reason}`);
}
console.log('');
