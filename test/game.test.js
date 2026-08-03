import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Game, STATE } from '../src/game.js';
import { MODE } from '../src/surfer.js';
import { SURFER } from '../src/config.js';

/** The whole game runs headless — only `render` needs a canvas. */
const silent = new Proxy({}, { get: () => () => {}, set: () => true });

const NONE = {
  up: false, down: false, left: false, right: false, action: false,
  actionPressed: false, startPressed: false, pausePressed: false, mutePressed: false,
};
const press = (extra) => ({ ...NONE, ...extra });

function newGame(seed = 1) {
  return new Game({ audio: silent, seed });
}

function play(game, seconds, input = NONE) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) { game.update(dt, input); }
}

test('the game opens on a living title screen', () => {
  const game = newGame();
  assert.equal(game.state, STATE.title);

  const before = game.wave.scroll;
  play(game, 1);
  assert.ok(game.wave.scroll > before, 'the wave rolls behind the title');
  assert.equal(game.state, STATE.title, 'and nothing starts on its own');
});

test('space paddles out', () => {
  const game = newGame();
  game.update(1 / 60, press({ startPressed: true }));
  assert.equal(game.state, STATE.playing);
  assert.equal(game.surfer.mode, MODE.riding);
  assert.equal(game.score.total, 0);
});

test('a run accumulates distance and speeds up over time', () => {
  const game = newGame();
  game.start();
  const early = game.surfer.speed;

  game.score.distance = 40000; // fast-forward the difficulty ramp
  play(game, 1);

  assert.ok(game.difficulty > 0.9);
  assert.ok(game.surfer.speed > early);
});

test('P pauses and unpauses', () => {
  const game = newGame();
  game.start();

  game.update(1 / 60, press({ pausePressed: true }));
  assert.equal(game.state, STATE.paused);

  const frozen = game.score.total;
  play(game, 1);
  assert.equal(game.score.total, frozen, 'a paused game does not tick');

  game.update(1 / 60, press({ pausePressed: true }));
  assert.equal(game.state, STATE.playing);
});

test('hitting someone ends the run, with a reason', () => {
  const game = newGame();
  game.start();
  play(game, 0.2);

  // Park a body exactly where the surfer is. `baseH` is the one that sticks —
  // `h` is re-derived from it every frame by the bobbing motion.
  const victim = game.obstacles.trySpawn(game.surfer.speed, 0);
  victim.x = game.surfer.x;
  victim.baseH = game.surfer.h;
  victim.update(0, 0, game.wave);

  play(game, 0.05);
  assert.equal(game.surfer.mode, MODE.wipeout);
  assert.ok(game.reason.length > 0);

  play(game, 2);
  assert.equal(game.state, STATE.over, 'the wipeout plays out, then the panel appears');
});

test('the result panel ignores a mashed space bar for a moment', () => {
  const game = newGame();
  game.start();
  game.beginWipeout();
  for (let i = 0; i < 600 && game.state !== STATE.over; i += 1) { game.update(1 / 60, NONE); }
  assert.equal(game.state, STATE.over);

  game.update(1 / 60, press({ startPressed: true }));
  assert.equal(game.state, STATE.over, 'too soon');

  play(game, 0.6);
  game.update(1 / 60, press({ startPressed: true }));
  assert.equal(game.state, STATE.playing, 'and then it goes again');
});

test('starting again wipes the previous run clean', () => {
  const game = newGame();
  game.start();
  play(game, 3, press({ down: true }));
  const distance = game.score.distance;
  assert.ok(distance > 0);

  game.start();
  assert.equal(game.score.distance, 0);
  assert.equal(game.score.landedTricks, 0);
  assert.equal(game.obstacles.items.length, 0);
  assert.equal(game.surfer.mode, MODE.riding);
});

test('a landed spin scores points and builds the combo', () => {
  const game = newGame();
  game.start();

  game.handleLanding({
    clean: true, rotations: 2, airTime: 1.1, grabTime: 0.5, offAxis: 0.1, power: 0.9,
  });

  assert.equal(game.score.landedTricks, 1);
  assert.ok(game.score.trickScore > 0);
  assert.ok(game.popups.items.length >= 2, 'the trick name and the points both pop up');
});

test('a blown landing ends the run', () => {
  const game = newGame();
  game.start();

  game.handleLanding({
    clean: false, rotations: 1, airTime: 0.9, grabTime: 0, offAxis: 1.6, power: 0.8,
  });

  assert.equal(game.surfer.mode, MODE.wipeout);
  assert.match(game.reason, /sideways|upside/);
});

test('barrel sections arrive, pay out in the pocket, and close', () => {
  const game = newGame();
  game.start();
  game.score.distance = game.wave.nextBarrelAt + 1;
  game.surfer.h = 0.7;

  play(game, 0.05);
  assert.ok(game.wave.inBarrel, 'the section opens once you have earned it');
  assert.ok(game.wave.nextBarrelAt > game.score.distance, 'and the next one is scheduled');

  const before = game.score.barrelScore;
  for (let i = 0; i < 60; i += 1) {
    game.surfer.h = 0.72; // hold the pocket
    game.update(1 / 60, NONE);
  }
  assert.ok(game.score.barrelScore > before, 'holding the pocket pays');

  play(game, 6);
  assert.equal(game.wave.inBarrel, false, 'and the section closes out');
});

test('the camera follows the surfer into the air and settles back', () => {
  const game = newGame();
  game.start();
  game.surfer.h = 1;
  game.update(1 / 60, press({ actionPressed: true }));
  assert.equal(game.surfer.mode, MODE.air);

  play(game, 0.45);
  assert.ok(game.camY > 10, `camera should pan up, got ${game.camY}`);

  play(game, 4);
  assert.ok(game.camY < 6, `camera should settle, got ${game.camY}`);
});

test('a long unattended run never produces a bad number', () => {
  const game = newGame(77);
  game.start();

  const inputs = [
    press({ up: true }), press({ up: true, actionPressed: true }), press({ right: true }),
    press({ down: true }), press({ left: true, action: true }), NONE,
  ];

  for (let frame = 0; frame < 7000; frame += 1) {
    game.update(1 / 60, inputs[Math.floor(frame / 40) % inputs.length]);

    for (const key of ['camY', 'shake', 'timeScale', 'time']) {
      assert.ok(Number.isFinite(game[key]), `game.${key} went bad on frame ${frame}`);
    }
    for (const key of ['x', 'y', 'h', 'speed', 'spin']) {
      assert.ok(Number.isFinite(game.surfer[key]), `surfer.${key} went bad on frame ${frame}`);
    }
    assert.ok(Number.isFinite(game.score.total));

    if (game.state === STATE.over) { game.start(); }
  }
});

test('the surfer stays on screen even after the biggest possible air', () => {
  const game = newGame(5);
  game.start();
  game.score.distance = 40000;

  for (let i = 0; i < 40; i += 1) {
    game.surfer.h = 1;
    game.surfer.speed = 2000; // absurd, to maximise the pop
    game.update(1 / 60, press({ actionPressed: true }));
  }

  play(game, 3);
  const screenY = game.surfer.y + game.camY;
  assert.ok(screenY > 0 && screenY < 540, `surfer left the frame at y=${screenY}`);
  assert.ok(game.surfer.x < SURFER.homeX + 200, 'and never runs off the right edge');
});
