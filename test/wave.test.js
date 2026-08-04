import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Wave } from '../src/wave.js';
import { BARREL, VIEW } from '../src/config.js';

test('the trough is always below the crest, everywhere, at any scroll', () => {
  const wave = new Wave();
  for (let scroll = 0; scroll < 20000; scroll += 137) {
    wave.scroll = scroll;
    for (let x = -40; x <= VIEW.width + 40; x += 40) {
      assert.ok(
        wave.troughAt(x) - wave.crestAt(x) > 100,
        `face collapsed at x=${x}, scroll=${scroll}`,
      );
    }
  }
});

test('yAt and heightAt round-trip', () => {
  const wave = new Wave();
  wave.scroll = 1234;
  for (const h of [0, 0.25, 0.5, 0.75, 1]) {
    const y = wave.yAt(300, h);
    assert.ok(Math.abs(wave.heightAt(300, y) - h) < 1e-9);
  }
});

test('h = 1 sits on the crest and h = 0 on the trough', () => {
  const wave = new Wave();
  assert.equal(wave.yAt(120, 1), wave.crestAt(120));
  assert.equal(wave.yAt(120, 0), wave.troughAt(120));
});

test('advancing the wave scrolls it', () => {
  const wave = new Wave();
  const before = wave.crestAt(400);
  wave.advance(500);
  assert.equal(wave.scroll, 500);
  assert.notEqual(wave.crestAt(400), before);
});

test('slopeAt is signed the same way as the surface it samples', () => {
  const wave = new Wave();
  const slope = wave.slopeAt(300, 0.5);
  const rising = wave.yAt(314, 0.5) - wave.yAt(286, 0.5);
  assert.equal(Math.sign(slope), Math.sign(rising));
  assert.ok(Math.abs(slope) < 1, 'the face should never be a cliff');
});

test('a barrel opens, peaks and closes out', () => {
  const wave = new Wave();
  assert.equal(wave.inBarrel, false);
  assert.equal(wave.barrelIntensity(), 0);

  wave.startBarrel(4);
  assert.ok(wave.inBarrel);
  assert.ok(wave.barrelIntensity() < 0.1, 'the lip has not thrown yet');

  wave.updateBarrel(2);
  assert.ok(wave.barrelIntensity() > 0.95, 'fully pitched over mid-section');

  wave.updateBarrel(1.7);
  assert.ok(wave.barrelIntensity() < 0.9, 'closing out');

  wave.updateBarrel(0.5);
  assert.equal(wave.inBarrel, false, 'the section ends on its own');
  assert.equal(wave.barrelIntensity(), 0);
});

test('the pocket is only the middle band of the barrel', () => {
  const wave = new Wave();
  wave.startBarrel();
  wave.updateBarrel(1);

  assert.ok(wave.inPocket((BARREL.pocketLow + BARREL.pocketHigh) / 2));
  assert.ok(!wave.inPocket(BARREL.pocketLow - 0.05));
  assert.ok(!wave.inPocket(BARREL.pocketHigh + 0.05));
});

test('pocketDepth peaks in the middle and is zero outside a barrel', () => {
  const wave = new Wave();
  assert.equal(wave.pocketDepth(0.7), 0);

  wave.startBarrel();
  const middle = (BARREL.pocketLow + BARREL.pocketHigh) / 2;
  assert.ok(wave.pocketDepth(middle) > 0.99);
  assert.ok(wave.pocketDepth(BARREL.pocketLow) < 0.05);
});
