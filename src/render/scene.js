import { VIEW, PALETTE } from '../config.js';
import { createRng } from '../util/rng.js';

const HORIZON = 140;

/**
 * Everything behind the wave: sky, sun, clouds, a headland with palms, and the
 * swells rolling in from outside. All of it is generated once from a fixed
 * seed and then scrolled at its own parallax rate.
 */
export class Scene {
  constructor(seed = 20160704) {
    const rng = createRng(seed);

    this.clouds = Array.from({ length: 9 }, () => ({
      x: rng.range(-200, VIEW.width + 400),
      y: rng.range(18, 112),
      scale: rng.range(0.55, 1.5),
      speed: rng.range(0.012, 0.035),
      puffs: Array.from({ length: rng.int(3, 5) }, () => ({
        dx: rng.range(-34, 34),
        dy: rng.range(-9, 7),
        r: rng.range(11, 24),
      })),
    }));

    this.swells = Array.from({ length: 4 }, (_, i) => ({
      y: HORIZON + 6 + i * 11,
      amplitude: rng.range(3, 8),
      frequency: rng.range(0.006, 0.013),
      phase: rng.range(0, 7),
      speed: 0.06 + i * 0.05,
      shade: 0.16 + i * 0.13,
    }));

    this.glitter = Array.from({ length: 40 }, () => ({
      x: rng.range(560, 930),
      y: rng.range(HORIZON + 2, HORIZON + 44),
      w: rng.range(4, 22),
      phase: rng.range(0, 7),
    }));

    this.palms = Array.from({ length: 5 }, (_, i) => ({
      x: 62 + i * 26 + rng.range(-8, 8),
      height: rng.range(16, 30),
      lean: rng.range(-0.22, 0.22),
      fronds: rng.int(5, 7),
    }));
  }

  draw(ctx, { scroll, camY, time }) {
    ctx.save();
    ctx.translate(0, camY * 0.3);
    this.drawSky(ctx);
    this.drawSun(ctx, time);
    this.drawClouds(ctx, scroll);
    this.drawHeadland(ctx, scroll);
    this.drawSwells(ctx, scroll, time);
    ctx.restore();
  }

  drawSky(ctx) {
    const gradient = ctx.createLinearGradient(0, -260, 0, HORIZON + 20);
    gradient.addColorStop(0, PALETTE.skyTop);
    gradient.addColorStop(0.45, PALETTE.skyMid);
    gradient.addColorStop(0.82, PALETTE.skyLow);
    gradient.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = gradient;
    ctx.fillRect(-40, -400, VIEW.width + 80, HORIZON + 420);
  }

  drawSun(ctx, time) {
    const x = 748;
    const y = 76;
    const pulse = 1 + Math.sin(time * 0.6) * 0.03;

    const glow = ctx.createRadialGradient(x, y, 6, x, y, 132 * pulse);
    glow.addColorStop(0, 'rgba(255, 240, 196, 0.95)');
    glow.addColorStop(0.35, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 150, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 132 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(x, y, 27, 0, Math.PI * 2);
    ctx.fill();
  }

  drawClouds(ctx, scroll) {
    for (const cloud of this.clouds) {
      const span = VIEW.width + 620;
      let x = (cloud.x - scroll * cloud.speed) % span;
      if (x < -300) { x += span; }

      ctx.save();
      ctx.translate(x, cloud.y);
      ctx.scale(cloud.scale, cloud.scale);

      ctx.fillStyle = PALETTE.cloudShade;
      for (const puff of cloud.puffs) {
        ctx.beginPath();
        ctx.arc(puff.dx, puff.dy + 4, puff.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = PALETTE.cloud;
      for (const puff of cloud.puffs) {
        ctx.beginPath();
        ctx.arc(puff.dx, puff.dy, puff.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawHeadland(ctx, scroll) {
    const span = VIEW.width + 900;
    let x = (-scroll * 0.05) % span;
    if (x < -520) { x += span; }

    ctx.save();
    ctx.translate(x, 0);
    ctx.fillStyle = PALETTE.headland;

    ctx.beginPath();
    ctx.moveTo(-40, HORIZON + 2);
    ctx.quadraticCurveTo(40, HORIZON - 34, 118, HORIZON - 26);
    ctx.quadraticCurveTo(190, HORIZON - 20, 232, HORIZON + 2);
    ctx.closePath();
    ctx.fill();

    for (const palm of this.palms) {
      this.drawPalm(ctx, palm.x, HORIZON - 24, palm);
    }
    ctx.restore();
  }

  drawPalm(ctx, x, y, palm) {
    ctx.strokeStyle = PALETTE.headland;
    ctx.lineCap = 'round';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + palm.lean * 14, y - palm.height * 0.6, x + palm.lean * 26, y - palm.height);
    ctx.stroke();

    const topX = x + palm.lean * 26;
    const topY = y - palm.height;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < palm.fronds; i += 1) {
      const angle = Math.PI + (i / (palm.fronds - 1)) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(
        topX + Math.cos(angle) * 7,
        topY + Math.sin(angle) * 6 - 4,
        topX + Math.cos(angle) * 12,
        topY + Math.sin(angle) * 9 + 2,
      );
      ctx.stroke();
    }
  }

  drawSwells(ctx, scroll, time) {
    // Fills all the way down rather than just the visible band: the wave is
    // drawn over the top of it, and on a big air the camera pans far enough
    // that a short fill would leave a seam.
    ctx.fillStyle = PALETTE.backSwell;
    ctx.fillRect(-40, HORIZON, VIEW.width + 80, VIEW.height + 900);

    // Sun glitter on the distant water.
    ctx.fillStyle = 'rgba(255, 244, 210, 0.5)';
    for (const spark of this.glitter) {
      const flicker = 0.35 + 0.65 * Math.abs(Math.sin(time * 2.4 + spark.phase));
      ctx.globalAlpha = flicker * 0.6;
      ctx.fillRect(spark.x, spark.y, spark.w * flicker, 1.4);
    }
    ctx.globalAlpha = 1;

    for (const swell of this.swells) {
      // Each swell fills all the way down rather than as a fixed-height band:
      // only its top contour should be a visible line, and a band would show
      // a hard bottom edge once the camera pans up on a big air.
      const floor = VIEW.height + 900;
      ctx.beginPath();
      ctx.moveTo(-40, swell.y);
      for (let x = -40; x <= VIEW.width + 40; x += 12) {
        const y = swell.y + Math.sin((x + scroll * swell.speed) * swell.frequency + swell.phase) * swell.amplitude;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(VIEW.width + 40, floor);
      ctx.lineTo(-40, floor);
      ctx.closePath();
      ctx.fillStyle = `rgba(6, 63, 82, ${swell.shade})`;
      ctx.fill();

      ctx.beginPath();
      for (let x = -40; x <= VIEW.width + 40; x += 12) {
        const y = swell.y + Math.sin((x + scroll * swell.speed) * swell.frequency + swell.phase) * swell.amplitude;
        if (x === -40) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
      }
      ctx.strokeStyle = PALETTE.backSwellFoam;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

export { HORIZON };
