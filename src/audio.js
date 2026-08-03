import { STORAGE_KEYS } from './config.js';
import { read, write } from './util/storage.js';

/**
 * Every sound in the game is synthesised at runtime — there is not a single
 * audio file in the repo.
 *
 * Water is filtered white noise whose cutoff and gain track how fast you're
 * going; the musical stings are short oscillator envelopes on a pentatonic
 * scale so combos climb pleasantly instead of clashing.
 */

const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

function noteToHz(semitonesAboveA3) {
  return 220 * Math.pow(2, semitonesAboveA3 / 12);
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = read(STORAGE_KEYS.muted, 'false') === 'true';
    this.intensity = 0;
  }

  /** Must be called from inside a user gesture, or browsers will refuse. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') { this.ctx.resume(); }
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) { return; }

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(this.ctx.destination);

    this.noiseBuffer = this.makeNoise(2);
    this.startAmbient();
    this.ready = true;
  }

  makeNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  startAmbient() {
    // Low rumble of the wave.
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    this.ambientFilter = this.ctx.createBiquadFilter();
    this.ambientFilter.type = 'lowpass';
    this.ambientFilter.frequency.value = 420;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.05;

    source.connect(this.ambientFilter).connect(this.ambientGain).connect(this.master);
    source.start();

    // Brighter hiss layered on top, which is what actually sells "speed".
    const hissSource = this.ctx.createBufferSource();
    hissSource.buffer = this.noiseBuffer;
    hissSource.loop = true;

    this.hissFilter = this.ctx.createBiquadFilter();
    this.hissFilter.type = 'bandpass';
    this.hissFilter.frequency.value = 1800;
    this.hissFilter.Q.value = 0.7;

    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.value = 0;

    hissSource.connect(this.hissFilter).connect(this.hissGain).connect(this.master);
    hissSource.start();
  }

  /** @param {number} speedNorm 0..1 */
  setIntensity(speedNorm, inBarrel = false, riding = true) {
    if (!this.ready) { return; }
    this.intensity = speedNorm;
    const now = this.ctx.currentTime;
    const hiss = riding ? 0.012 + speedNorm * 0.05 : 0.004;
    this.hissGain.gain.setTargetAtTime(inBarrel ? hiss * 2.4 : hiss, now, 0.15);
    this.hissFilter.frequency.setTargetAtTime(1200 + speedNorm * 2600, now, 0.2);
    this.ambientGain.gain.setTargetAtTime(inBarrel ? 0.16 : 0.05, now, 0.25);
    this.ambientFilter.frequency.setTargetAtTime(inBarrel ? 260 : 420 + speedNorm * 300, now, 0.25);
  }

  toggleMute() {
    this.muted = !this.muted;
    write(STORAGE_KEYS.muted, this.muted);
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  // --- Building blocks -----------------------------------------------------

  noiseHit({ duration = 0.4, type = 'bandpass', from = 900, to = 300, q = 1, gain = 0.3 }) {
    if (!this.ready || this.muted) { return; }
    const now = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), now + duration);

    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter).connect(envelope).connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.05);
  }

  tone({ freq = 440, duration = 0.25, type = 'triangle', gain = 0.18, glide = 0, delay = 0 }) {
    if (!this.ready || this.muted) { return; }
    const now = this.ctx.currentTime + delay;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * glide), now + duration);
    }

    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(envelope).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  // --- Game sounds ---------------------------------------------------------

  launch(power = 0.6) {
    this.noiseHit({ duration: 0.34, from: 500, to: 2600, q: 1.4, gain: 0.22 + power * 0.16 });
    this.tone({ freq: 180 + power * 130, duration: 0.28, type: 'sine', gain: 0.12, glide: 2.2 });
  }

  pump() {
    this.noiseHit({ duration: 0.18, from: 700, to: 180, q: 1.2, gain: 0.16 });
  }

  lipSpray() {
    this.noiseHit({ duration: 0.22, from: 2600, to: 1200, q: 0.9, gain: 0.12 });
  }

  landing(clean, power = 0.5) {
    this.noiseHit({
      duration: clean ? 0.42 : 0.7,
      type: 'lowpass',
      from: clean ? 2600 : 1400,
      to: clean ? 320 : 90,
      gain: 0.26 + power * 0.18,
    });
  }

  trick(index = 0) {
    const step = PENTATONIC[Math.min(index, PENTATONIC.length - 1)];
    this.tone({ freq: noteToHz(step + 12), duration: 0.3, type: 'triangle', gain: 0.2 });
    this.tone({ freq: noteToHz(step + 19), duration: 0.36, type: 'sine', gain: 0.13, delay: 0.06 });
  }

  nearMiss() {
    this.tone({ freq: 1180, duration: 0.09, type: 'sine', gain: 0.08 });
  }

  wipeout() {
    this.noiseHit({ duration: 1.1, type: 'lowpass', from: 1800, to: 60, gain: 0.4 });
    this.tone({ freq: 190, duration: 0.9, type: 'sawtooth', gain: 0.14, glide: 0.35 });
  }

  barrelStart() {
    this.tone({ freq: 110, duration: 1.2, type: 'sine', gain: 0.2, glide: 0.7 });
    this.noiseHit({ duration: 1.0, type: 'lowpass', from: 900, to: 200, gain: 0.22 });
  }

  highScore() {
    [0, 4, 7, 12].forEach((step, i) => {
      this.tone({ freq: noteToHz(step + 12), duration: 0.4, type: 'triangle', gain: 0.16, delay: i * 0.1 });
    });
  }

  start() {
    this.tone({ freq: noteToHz(7), duration: 0.18, type: 'triangle', gain: 0.14 });
    this.tone({ freq: noteToHz(14), duration: 0.26, type: 'triangle', gain: 0.12, delay: 0.08 });
  }
}
