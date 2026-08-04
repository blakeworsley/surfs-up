import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Surfer, MODE } from '../src/surfer.js';
import { Wave } from '../src/wave.js';
import { SURFER } from '../src/config.js';
import { TAU, offAxis, completedRotations } from '../src/util/math.js';

const NONE = { up: false, down: false, left: false, right: false, action: false, actionPressed: false };
const press = (extra) => ({ ...NONE, ...extra });

/** Run the surfer for `seconds` of game time and collect everything it emits. */
function run(surfer, wave, seconds, input = NONE, difficulty = 0) {
  const events = [];
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    events.push(...surfer.update(dt, input, wave, difficulty));
  }
  return events;
}

test('a new surfer starts riding, mid-face, on the wave', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.update(1 / 60, NONE, wave, 0);

  assert.equal(surfer.mode, MODE.riding);
  assert.ok(surfer.h > 0 && surfer.h < 1);
  assert.ok(Math.abs(surfer.y - wave.yAt(surfer.x, surfer.h)) < 1e-9);
});

test('holding up climbs to the lip; holding down drops to the trough', () => {
  const wave = new Wave();
  const surfer = new Surfer();

  run(surfer, wave, 3, press({ up: true }));
  assert.ok(surfer.h > 0.98, `expected to reach the lip, got h=${surfer.h}`);

  run(surfer, wave, 3, press({ down: true }));
  assert.ok(surfer.h < 0.1, `expected to reach the trough, got h=${surfer.h}`);
});

test('the face pulls you down when you stop working for it', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.h = 0.8;
  run(surfer, wave, 2);
  assert.ok(surfer.h < 0.8, 'gravity should bleed height away');
});

test('height on the face never escapes its bounds', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  for (const input of [press({ up: true }), press({ down: true })]) {
    run(surfer, wave, 6, input);
    assert.ok(surfer.h >= SURFER.minH - 1e-9 && surfer.h <= SURFER.maxH + 1e-9);
  }
});

test('riding low is faster than riding high', () => {
  const wave = new Wave();

  const low = new Surfer();
  run(low, wave, 4, press({ down: true }));

  const high = new Surfer();
  run(high, new Wave(), 4, press({ up: true }));

  assert.ok(low.speed > high.speed, `low ${low.speed} should beat high ${high.speed}`);
});

test('space near the trough pumps for speed instead of launching', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.h = 0.2;
  const before = surfer.speed;

  const events = surfer.update(1 / 60, press({ actionPressed: true }), wave, 0);

  assert.equal(surfer.mode, MODE.riding, 'too low on the face to launch');
  assert.ok(events.some((e) => e.type === 'pump'));
  assert.ok(surfer.speed > before);
});

test('the pump has a cooldown, so it cannot be mashed', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.h = 0.2;

  let pumps = 0;
  for (let i = 0; i < 12; i += 1) {
    pumps += surfer.update(1 / 60, press({ actionPressed: true }), wave, 0)
      .filter((e) => e.type === 'pump').length;
  }
  assert.equal(pumps, 1);
});

test('space high on the face launches you off the lip', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.h = 0.95;

  const events = surfer.update(1 / 60, press({ actionPressed: true }), wave, 0);

  assert.equal(surfer.mode, MODE.air);
  const launch = events.find((e) => e.type === 'launch');
  assert.ok(launch, 'a launch event should be emitted');
  assert.ok(launch.power > 0.5, 'launching from the lip should be a big one');
  assert.ok(surfer.vy < 0, 'you go up');
});

test('a higher launch gives a bigger pop than a marginal one', () => {
  const big = new Surfer();
  big.h = 1;
  const bigLaunch = big.update(1 / 60, press({ actionPressed: true }), new Wave(), 0)
    .find((e) => e.type === 'launch');

  const small = new Surfer();
  small.h = SURFER.launchMinH + 0.01;
  const smallLaunch = small.update(1 / 60, press({ actionPressed: true }), new Wave(), 0)
    .find((e) => e.type === 'launch');

  assert.ok(bigLaunch.power > smallLaunch.power);
  assert.ok(big.vy < small.vy);
});

test('you cannot launch inside a barrel — there is a roof', () => {
  const wave = new Wave();
  wave.startBarrel();
  const surfer = new Surfer();
  surfer.h = 0.95;

  surfer.update(1 / 60, press({ actionPressed: true }), wave, 0);
  assert.equal(surfer.mode, MODE.riding);
});

test('what goes up comes back down and lands', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.h = 0.95;
  surfer.update(1 / 60, press({ actionPressed: true }), wave, 0);

  const events = run(surfer, wave, 3);
  const landing = events.find((e) => e.type === 'land');

  assert.ok(landing, 'the surfer must come back to the wave');
  assert.ok(landing.airTime > 0.5, `air time was only ${landing.airTime}s`);
  assert.equal(landing.clean, true, 'no spin means a clean landing');
  assert.equal(surfer.mode, MODE.riding);
});

test('left and right spin the board in opposite directions', () => {
  const wave = new Wave();

  const backside = new Surfer();
  backside.h = 1;
  backside.update(1 / 60, press({ actionPressed: true }), wave, 0);
  run(backside, wave, 0.4, press({ left: true }));

  const frontside = new Surfer();
  frontside.h = 1;
  frontside.update(1 / 60, press({ actionPressed: true }), new Wave(), 0);
  run(frontside, new Wave(), 0.4, press({ right: true }));

  assert.ok(backside.spin < -0.3);
  assert.ok(frontside.spin > 0.3);
});

test('a full rotation brought back around lands clean and scores as a 360', () => {
  const wave = new Wave();
  const surfer = new Surfer();

  surfer.mode = MODE.air;
  surfer.x = SURFER.homeX;
  surfer.y = wave.crestAt(surfer.x) - 4;
  surfer.vy = 400;
  surfer.spin = TAU;
  surfer.airTime = 0.9;

  const landing = surfer.update(1 / 60, NONE, wave, 0).find((e) => e.type === 'land');

  assert.ok(landing);
  assert.equal(landing.clean, true);
  assert.equal(landing.rotations, 1);
  assert.equal(surfer.mode, MODE.riding);
  assert.equal(surfer.spin, 0, 'rotation resets once you are back on the water');
});

test('landing backwards is a wipeout', () => {
  const wave = new Wave();
  const surfer = new Surfer();

  surfer.mode = MODE.air;
  surfer.y = wave.crestAt(surfer.x) - 4;
  surfer.vy = 400;
  surfer.spin = Math.PI;
  surfer.airTime = 0.8;

  const landing = surfer.update(1 / 60, NONE, wave, 0).find((e) => e.type === 'land');

  assert.equal(landing.clean, false);
  assert.equal(surfer.mode, MODE.wipeout);
});

test('the landing window is generous but not infinite', () => {
  // `outside` clears the tolerance by more than one frame of the settle assist,
  // which shaves ~11% off the tilt before touchdown is evaluated.
  const inside = SURFER.landingTolerance - 0.05;
  const outside = SURFER.landingTolerance + 0.25;

  for (const [spin, expected] of [[inside, true], [-inside, true], [outside, false], [-outside, false]]) {
    const wave = new Wave();
    const surfer = new Surfer();
    surfer.mode = MODE.air;
    surfer.y = wave.crestAt(surfer.x) - 4;
    surfer.vy = 400;
    surfer.spin = spin;
    surfer.airTime = 0.6;

    const landing = surfer.update(1 / 60, NONE, wave, 0).find((e) => e.type === 'land');
    assert.equal(landing.clean, expected, `spin ${spin.toFixed(2)} should be clean=${expected}`);
  }
});

test('letting go of the spin settles the board upright', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.mode = MODE.air;
  surfer.y = wave.crestAt(surfer.x) - 900; // plenty of air left
  surfer.vy = -100;
  surfer.spin = TAU + 1.1; // a rotation and a bit, well outside the window
  surfer.spinRate = 0;

  run(surfer, wave, 0.6);

  assert.ok(offAxis(surfer.spin) < 0.2, `expected it to settle, got ${offAxis(surfer.spin)}`);
  assert.equal(completedRotations(surfer.spin), 1, 'and to settle to the nearest rotation, not unwind');
});

test('holding a spin key keeps rotating instead of settling', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.mode = MODE.air;
  surfer.y = wave.crestAt(surfer.x) - 900;
  surfer.vy = -100;

  run(surfer, wave, 0.6, press({ right: true }));
  assert.ok(surfer.spin > 2, `expected a real rotation, got ${surfer.spin}`);
});

test('a whole air spent holding the spin ends in the water', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.h = 1;
  surfer.update(1 / 60, press({ actionPressed: true }), wave, 0);

  const landing = run(surfer, wave, 3, press({ right: true })).find((e) => e.type === 'land');
  assert.equal(landing.clean, false, 'you still have to set the landing up');
});

test('holding the grab slows the spin down', () => {
  const wave = new Wave();

  const free = new Surfer();
  free.h = 1;
  free.update(1 / 60, press({ actionPressed: true }), wave, 0);
  run(free, wave, 0.5, press({ right: true }));

  const grabbed = new Surfer();
  grabbed.h = 1;
  grabbed.update(1 / 60, press({ actionPressed: true }), new Wave(), 0);
  run(grabbed, new Wave(), 0.5, press({ right: true, action: true }));

  assert.ok(grabbed.spin < free.spin, 'a grab should cost you rotation speed');
  assert.ok(grabbed.grabTime > 0.4, 'and should bank grab time');
});

test('diving in the air brings you down sooner', () => {
  const wave = new Wave();

  const floaty = new Surfer();
  floaty.h = 1;
  floaty.update(1 / 60, press({ actionPressed: true }), wave, 0);
  const floatyEvents = run(floaty, wave, 3);

  const dived = new Surfer();
  dived.h = 1;
  const wave2 = new Wave();
  dived.update(1 / 60, press({ actionPressed: true }), wave2, 0);
  const divedEvents = run(dived, wave2, 3, press({ down: true }));

  const a = floatyEvents.find((e) => e.type === 'land').airTime;
  const b = divedEvents.find((e) => e.type === 'land').airTime;
  assert.ok(b < a, `dive (${b}s) should be shorter than float (${a}s)`);
});

test('a wipeout is terminal — nothing brings you back mid-run', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  surfer.wipeout();

  run(surfer, wave, 2, press({ up: true, actionPressed: true }));

  assert.equal(surfer.mode, MODE.wipeout);
  assert.ok(surfer.speed < 60, 'and you lose all your speed');
});

test('nothing in a long simulated ride ever goes NaN', () => {
  const wave = new Wave();
  const surfer = new Surfer();
  const inputs = [
    press({ up: true }), press({ down: true }), press({ up: true, actionPressed: true }),
    press({ left: true }), press({ right: true, action: true }), NONE,
  ];

  for (let i = 0; i < 4000; i += 1) {
    surfer.update(1 / 60, inputs[i % inputs.length], wave, (i % 1000) / 1000);
    wave.advance(surfer.speed / 60);
    for (const key of ['x', 'y', 'h', 'vh', 'vy', 'speed', 'spin', 'spinRate']) {
      assert.ok(Number.isFinite(surfer[key]), `${key} went bad on frame ${i}: ${surfer[key]}`);
    }
    if (surfer.mode === 'wipeout') { surfer.reset(); }
  }
});
