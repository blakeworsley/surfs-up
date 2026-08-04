import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ObstacleField, Obstacle, OBSTACLE_TYPES, freeCorridor, bandOf, FACE_SPAN,
} from '../src/obstacles.js';
import { Wave } from '../src/wave.js';
import { createRng } from '../src/util/rng.js';

const byId = (id) => OBSTACLE_TYPES.find((type) => type.id === id);

test('freeCorridor finds the widest gap left on the face', () => {
  assert.equal(freeCorridor([]), 1, 'an empty wave is all corridor');
  assert.equal(freeCorridor([[0, 0.3]]), 0.7);
  assert.equal(freeCorridor([[0.7, 1]]), 0.7);
  assert.ok(Math.abs(freeCorridor([[0, 0.3], [0.6, 1]]) - 0.3) < 1e-9);
  assert.equal(freeCorridor([[0, 1]]), 0, 'a wall leaves nothing');
});

test('freeCorridor merges overlapping and unsorted bands', () => {
  assert.ok(Math.abs(freeCorridor([[0.5, 0.8], [0, 0.6]]) - 0.2) < 1e-9);
  assert.equal(freeCorridor([[-1, 0.5], [0.5, 2]]), 0, 'bands are clipped to the face');
});

test('bandOf converts a hitbox into face-height units', () => {
  const obstacle = new Obstacle(byId('kook'), 500, 0.5);
  const [low, high] = bandOf(obstacle);
  assert.ok(Math.abs((high - low) - obstacle.height / FACE_SPAN) < 1e-9);
  assert.ok(low < 0.5 && high > 0.5);
});

test('obstacles only appear once the run has earned them', () => {
  const field = new ObstacleField(createRng(1));
  const early = field.availableTypes(0).map((t) => t.id);
  const late = field.availableTypes(1).map((t) => t.id);

  assert.ok(early.includes('kook'), 'kooks are there from the start');
  assert.ok(!early.includes('sup'), 'SUPs are a late-run problem');
  assert.equal(late.length, OBSTACLE_TYPES.length);
});

test('the spawner refuses to wall off the wave', () => {
  const field = new ObstacleField(createRng(9));
  const type = byId('sup');

  // Three tall obstacles stacked on top of each other would leave no line.
  field.items = [
    new Obstacle(type, 1000, 0.2),
    new Obstacle(type, 1010, 0.5),
  ];
  const blocker = new Obstacle(type, 1005, 0.8);

  assert.equal(field.canPlace(blocker, 400), false);
});

test('the spawner refuses to stack bodies on top of each other', () => {
  const field = new ObstacleField(createRng(9));
  field.items = [new Obstacle(byId('kook'), 1000, 0.4)];
  assert.equal(field.canPlace(new Obstacle(byId('kook'), 1020, 0.9), 400), false);
  assert.equal(field.canPlace(new Obstacle(byId('kook'), 1400, 0.4), 400), true);
});

test('a placement with a clear line through it is allowed', () => {
  const field = new ObstacleField(createRng(9));
  field.items = [new Obstacle(byId('swimmer'), 1000, 0.08)];
  assert.equal(field.canPlace(new Obstacle(byId('swimmer'), 1120, 0.16), 400), true);
});

test('a long simulated run never breaks the spacing rule', () => {
  const wave = new Wave();
  const field = new ObstacleField(createRng(2024));
  const dt = 1 / 60;
  let distance = 0;
  let seen = 0;

  for (let frame = 0; frame < 9000; frame += 1) {
    const difficulty = Math.min(frame / 6000, 1);
    const speed = 320 + difficulty * 300;
    distance += speed * dt;
    wave.advance(speed * dt);
    field.update(dt, speed, wave, difficulty, distance);
    seen = Math.max(seen, field.items.length);

    const riders = field.items.filter((item) => item.id !== 'seagull');
    for (let i = 0; i < riders.length; i += 1) {
      for (let j = i + 1; j < riders.length; j += 1) {
        assert.ok(
          Math.abs(riders[i].x - riders[j].x) > 70,
          `two riders piled up at frame ${frame}`,
        );
      }
    }
  }

  assert.ok(seen > 1, 'the run should actually produce traffic');
  assert.ok(distance > 30000);
});

test('obstacles ride the wave surface and eventually leave', () => {
  const wave = new Wave();
  const field = new ObstacleField(createRng(5));
  const obstacle = field.trySpawn(400, 0);
  assert.ok(obstacle);

  obstacle.update(1 / 60, 400, wave);
  assert.ok(Math.abs(obstacle.y - wave.yAt(obstacle.x, obstacle.h)) < 1e-9);

  for (let i = 0; i < 600; i += 1) { obstacle.update(1 / 60, 400, wave); }
  assert.ok(obstacle.offScreen);
});

test('paddlers climb the face and stop before the lip', () => {
  const wave = new Wave();
  const paddler = new Obstacle(byId('paddler'), 900, 0.2);
  const start = paddler.h;

  for (let i = 0; i < 60; i += 1) { paddler.update(1 / 60, 0, wave); }
  assert.ok(paddler.h > start, 'they paddle up into your line');

  for (let i = 0; i < 2000; i += 1) { paddler.update(1 / 60, 0, wave); }
  assert.ok(paddler.h <= 0.86 + 1e-9, 'but they never climb over the lip');
});

test('nothing spawns during a barrel section', () => {
  const wave = new Wave();
  wave.startBarrel(10);
  const field = new ObstacleField(createRng(11));

  for (let i = 0; i < 600; i += 1) {
    field.update(1 / 60, 400, wave, 1, 20000);
  }
  assert.equal(field.items.length, 0);
});

test('face obstacles and air obstacles never cross wires', () => {
  const wave = new Wave();
  const field = new ObstacleField(createRng(3));
  const gull = field.spawnSeagull(wave);
  gull.update(1 / 60, 0, wave);

  const box = { x: gull.x - 10, y: gull.y - 10, width: 20, height: 20 };
  assert.ok(field.collide(box, true), 'an airborne surfer can hit a seagull');
  assert.equal(field.collide(box, false), null, 'a surfer on the face cannot');
});

test('near misses are reported once each, only when they are close', () => {
  const wave = new Wave();
  const field = new ObstacleField(createRng(4));

  const close = new Obstacle(byId('kook'), 100, 0.5);
  const far = new Obstacle(byId('kook'), 100, 0.05);
  field.items = [close, far];
  for (const item of field.items) { item.update(0, 0, wave); }

  const surfer = { x: 250, y: wave.yAt(250, 0.5) };
  const first = field.collectNearMisses(surfer);

  assert.equal(first.length, 1, 'only the one that actually buzzed you');
  assert.equal(first[0], close);
  assert.equal(field.collectNearMisses(surfer).length, 0, 'and never twice');
});
