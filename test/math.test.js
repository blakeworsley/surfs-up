import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TAU, clamp, lerp, ratio, damp, normalizeAngle, offAxis,
  completedRotations, rectsOverlap, sineSum, smoothstep,
} from '../src/util/math.js';
import { createRng } from '../src/util/rng.js';

test('clamp holds a value inside its range', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(0.4, 0, 1), 0.4);
});

test('lerp and ratio are inverses of each other', () => {
  assert.equal(lerp(10, 20, 0.5), 15);
  assert.equal(ratio(15, 10, 20), 0.5);
  assert.equal(ratio(99, 10, 20), 1, 'ratio clamps above the range');
  assert.equal(ratio(5, 10, 10), 0, 'a zero-width range is not a divide by zero');
});

test('damp moves toward the target without overshooting', () => {
  let value = 0;
  for (let i = 0; i < 200; i += 1) { value = damp(value, 10, 5, 1 / 60); }
  assert.ok(value > 9.9 && value <= 10, `expected ~10, got ${value}`);
});

test('damp is stable at very large timesteps', () => {
  assert.ok(Math.abs(damp(0, 10, 5, 100) - 10) < 1e-6);
});

test('normalizeAngle wraps into -PI..PI', () => {
  assert.ok(Math.abs(normalizeAngle(TAU)) < 1e-9);
  assert.ok(Math.abs(normalizeAngle(-TAU * 3)) < 1e-9);
  assert.ok(Math.abs(normalizeAngle(TAU + 0.5) - 0.5) < 1e-9);
});

test('offAxis measures the tilt of a landing, ignoring full spins', () => {
  assert.ok(offAxis(TAU * 2 + 0.2) - 0.2 < 1e-9, 'two clean rotations land upright');
  assert.ok(Math.abs(offAxis(Math.PI) - Math.PI) < 1e-9, 'a 180 is as wrong as it gets');
});

test('completedRotations counts whole spins in either direction', () => {
  assert.equal(completedRotations(0), 0);
  assert.equal(completedRotations(TAU * 1.1), 1);
  assert.equal(completedRotations(-TAU * 2.05), 2);
  assert.equal(completedRotations(TAU * 0.4), 0, 'a near-miss rotation is not a spin');
});

test('rectsOverlap only reports genuine overlaps', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  assert.ok(rectsOverlap(a, { x: 5, y: 5, width: 10, height: 10 }));
  assert.ok(!rectsOverlap(a, { x: 10, y: 0, width: 10, height: 10 }), 'touching edges do not collide');
  assert.ok(!rectsOverlap(a, { x: 0, y: 40, width: 10, height: 10 }));
});

test('sineSum stays inside the sum of its amplitudes', () => {
  const terms = [{ amplitude: 3, frequency: 0.1, phase: 0 }, { amplitude: 2, frequency: 0.3, phase: 1 }];
  for (let x = 0; x < 500; x += 3) {
    assert.ok(Math.abs(sineSum(terms, x)) <= 5.0000001);
  }
});

test('smoothstep eases from 0 to 1', () => {
  assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(smoothstep(0, 1, 2), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
});

test('the rng is deterministic for a given seed', () => {
  const a = createRng(42);
  const b = createRng(42);
  const first = Array.from({ length: 20 }, () => a.next());
  const second = Array.from({ length: 20 }, () => b.next());
  assert.deepEqual(first, second);
  assert.ok(first.every((n) => n >= 0 && n < 1));
});

test('rng.weighted respects the weights', () => {
  const rng = createRng(7);
  const items = [{ id: 'a', weight: 9 }, { id: 'b', weight: 1 }];
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 4000; i += 1) { counts[rng.weighted(items).id] += 1; }
  assert.ok(counts.a > counts.b * 4, `expected a to dominate, got ${JSON.stringify(counts)}`);
  assert.ok(counts.b > 0, 'the unlikely option should still come up');
});

test('rng.int covers its whole inclusive range', () => {
  const rng = createRng(3);
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) { seen.add(rng.int(0, 3)); }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
});
