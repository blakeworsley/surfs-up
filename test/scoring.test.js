import { test } from 'node:test';
import assert from 'node:assert/strict';

import { describeTrick, Scoreboard } from '../src/scoring.js';
import { SCORING } from '../src/config.js';

const landing = (extra = {}) => ({
  clean: true, rotations: 0, airTime: 0.8, grabTime: 0, offAxis: 0, power: 0.7, ...extra,
});

test('a blown landing scores nothing at all', () => {
  assert.equal(describeTrick(landing({ clean: false, rotations: 3 })), null);
});

test('a tiny hop is not a trick', () => {
  assert.equal(describeTrick(landing({ airTime: 0.1 })), null);
});

test('rotations are named the way a surfer would name them', () => {
  assert.equal(describeTrick(landing({ rotations: 1 })).name, '360 SPIN');
  assert.equal(describeTrick(landing({ rotations: 2 })).name, '720 DOUBLE');
  assert.equal(describeTrick(landing({ rotations: 3 })).name, '1080 TRIPLE');
  assert.equal(describeTrick(landing({ rotations: 9 })).name, 'MEGA SPIN');
});

test('hang time alone is worth a callout', () => {
  assert.equal(describeTrick(landing({ airTime: 0.5 })).name, 'AIR');
  assert.equal(describeTrick(landing({ airTime: 1.2 })).name, 'BIG AIR');
});

test('a grab is added to the name and the points', () => {
  const plain = describeTrick(landing({ rotations: 1 }));
  const grabbed = describeTrick(landing({ rotations: 1, grabTime: 0.9 }));

  assert.equal(grabbed.name, '360 SPIN + GRAB');
  assert.ok(grabbed.points > plain.points);
});

test('a brushed grab does not count', () => {
  assert.equal(describeTrick(landing({ rotations: 1, grabTime: 0.1 })).name, '360 SPIN');
});

test('more rotations are always worth more', () => {
  let previous = 0;
  for (let rotations = 0; rotations <= 7; rotations += 1) {
    const { points } = describeTrick(landing({ rotations }));
    assert.ok(points > previous, `${rotations} rotations should beat ${rotations - 1}`);
    previous = points;
  }
});

test('score is distance plus tricks', () => {
  const board = new Scoreboard();
  board.reset();

  board.addDistance(1200);
  assert.equal(board.total, Math.floor(1200 * SCORING.pointsPerPixel));

  const before = board.total;
  board.landTrick(landing({ rotations: 1 }));
  assert.ok(board.total > before);
});

test('the combo multiplier builds with every landed trick and caps out', () => {
  const board = new Scoreboard();
  board.reset();
  assert.equal(board.multiplier, 1);

  board.landTrick(landing({ rotations: 1 }));
  assert.equal(board.multiplier, 1 + SCORING.comboStep);

  for (let i = 0; i < 40; i += 1) { board.landTrick(landing({ rotations: 1 })); }
  assert.equal(board.multiplier, SCORING.comboMax);
});

test('the same trick is worth more once the combo is running', () => {
  const cold = new Scoreboard();
  cold.reset();
  const first = cold.landTrick(landing({ rotations: 2 })).points;

  const hot = new Scoreboard();
  hot.reset();
  for (let i = 0; i < 4; i += 1) { hot.landTrick(landing({ rotations: 1 })); }
  const later = hot.landTrick(landing({ rotations: 2 })).points;

  assert.ok(later > first, `${later} should beat ${first}`);
});

test('a failed landing does not build the combo', () => {
  const board = new Scoreboard();
  board.reset();
  assert.equal(board.landTrick(landing({ clean: false, rotations: 2 })), null);
  assert.equal(board.multiplier, 1);
});

test('the best trick of a run is remembered', () => {
  const board = new Scoreboard();
  board.reset();

  board.landTrick(landing({ rotations: 1 }));
  board.landTrick(landing({ rotations: 3 }));
  board.landTrick(landing({ rotations: 0, airTime: 0.4 }));

  assert.equal(board.bestTrickThisRun, '1080 TRIPLE');
});

test('barrel time pays more the deeper in the pocket you are', () => {
  const shallow = new Scoreboard();
  shallow.reset();
  shallow.addBarrelTime(1, 0);

  const deep = new Scoreboard();
  deep.reset();
  deep.addBarrelTime(1, 1);

  assert.ok(deep.total > shallow.total);
  assert.equal(deep.barrelTime, 1);
});

test('resetting a run clears the score but keeps the personal best', () => {
  const board = new Scoreboard();
  board.reset();
  board.addDistance(50000);
  const best = board.highScore;
  assert.ok(best > 0);

  board.reset();
  assert.equal(board.total, 0);
  assert.equal(board.highScore, best);
  assert.equal(board.beatHighScore, false);
});
