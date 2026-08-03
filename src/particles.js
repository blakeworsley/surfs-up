import { PALETTE } from './config.js';
import { clamp } from './util/math.js';

/**
 * One pooled particle system for every bit of water in the game: fin wake,
 * lip spray, landing explosions and the mist that hangs off the crest.
 *
 * `drift` is how strongly a particle scrolls with the wave — 1 sticks to the
 * water, 0 hangs in the air.
 */
export class Particles {
  constructor(limit = 620) {
    this.limit = limit;
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  spawn(options) {
    if (this.items.length >= this.limit) { this.items.shift(); }
    this.items.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 620,
      drag: 0.6,
      size: 3,
      life: 0,
      maxLife: 0.6,
      drift: 1,
      color: PALETTE.spray,
      kind: 'drop',
      ...options,
    });
  }

  update(dt, worldSpeed) {
    const alive = [];
    for (const p of this.items) {
      p.life += dt;
      if (p.life >= p.maxLife) { continue; }
      p.vy += p.gravity * dt;
      p.vx -= p.vx * p.drag * dt;
      p.x += (p.vx - worldSpeed * p.drift) * dt;
      p.y += p.vy * dt;
      alive.push(p);
    }
    this.items = alive;
  }

  draw(ctx) {
    for (const p of this.items) {
      const t = p.life / p.maxLife;
      const fade = 1 - t * t;
      ctx.globalAlpha = clamp(fade, 0, 1);
      ctx.fillStyle = p.color;
      const size = p.kind === 'foam' ? p.size * (0.6 + t * 1.5) : p.size * (1 - t * 0.45);
      if (p.kind === 'streak') {
        ctx.fillRect(p.x, p.y, size * 5, size * 0.7);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.4, size), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // --- Emitters ------------------------------------------------------------

  /** The rooster tail thrown off the fin while carving. */
  wake(rng, x, y, speed, amount = 1) {
    const count = Math.round(2 * amount);
    for (let i = 0; i < count; i += 1) {
      this.spawn({
        x: x + rng.range(-6, 8),
        y: y + rng.range(-2, 8),
        vx: rng.range(-40, 30) - speed * 0.05,
        vy: rng.range(-90, -20),
        size: rng.range(1.4, 3.2),
        maxLife: rng.range(0.3, 0.65),
        gravity: 540,
        drift: 0.9,
      });
    }
  }

  /** Big fan of water — off the lip, and on touchdown. */
  burst(rng, x, y, power = 1, options = {}) {
    const count = Math.round(18 * power) + 8;
    for (let i = 0; i < count; i += 1) {
      const angle = rng.range(-Math.PI * 0.95, -Math.PI * 0.05);
      const speed = rng.range(80, 340) * (0.6 + power * 0.7);
      this.spawn({
        x: x + rng.range(-10, 10),
        y: y + rng.range(-6, 6),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rng.range(1.6, 4.4),
        maxLife: rng.range(0.35, 0.95),
        gravity: 700,
        drift: 0.8,
        ...options,
      });
    }
  }

  /** Slow, soft foam that lingers on the crest. */
  mist(rng, x, y) {
    this.spawn({
      x,
      y,
      vx: rng.range(-20, 40),
      vy: rng.range(-40, -8),
      size: rng.range(3, 9),
      maxLife: rng.range(0.7, 1.5),
      gravity: 40,
      drag: 1.4,
      drift: 1,
      kind: 'foam',
      color: 'rgba(240, 253, 255, 0.55)',
    });
  }

  /** Horizontal speed lines when the surfer is really moving. */
  speedLine(rng, x, y) {
    this.spawn({
      x,
      y,
      vx: rng.range(-140, -60),
      vy: 0,
      size: rng.range(1.4, 2.6),
      maxLife: rng.range(0.18, 0.34),
      gravity: 0,
      drag: 0,
      drift: 0.7,
      kind: 'streak',
      color: 'rgba(255,255,255,0.5)',
    });
  }
}

/** Floating text: trick names, point values and the shouts from the water. */
export class Popups {
  constructor() {
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  add(text, x, y, options = {}) {
    this.items.push({
      text,
      x,
      y,
      life: 0,
      maxLife: 1.5,
      rise: 46,
      size: 26,
      color: PALETTE.hud,
      weight: '700',
      drift: 0.35,
      ...options,
    });
  }

  update(dt, worldSpeed) {
    for (const item of this.items) {
      item.life += dt;
      item.x -= worldSpeed * item.drift * dt;
    }
    this.items = this.items.filter((item) => item.life < item.maxLife);
  }

  draw(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const item of this.items) {
      const t = item.life / item.maxLife;
      const pop = t < 0.14 ? 0.6 + (t / 0.14) * 0.55 : 1.15 - (t - 0.14) * 0.16;
      ctx.globalAlpha = clamp(1 - Math.max(0, t - 0.55) / 0.45, 0, 1);
      ctx.font = `${item.weight} ${Math.round(item.size * pop)}px "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(6, 40, 54, 0.55)';
      ctx.lineJoin = 'round';
      const y = item.y - item.rise * t;
      ctx.strokeText(item.text, item.x, y);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, y);
    }
    ctx.globalAlpha = 1;
  }
}
