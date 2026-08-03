import { VIEW, PALETTE } from '../config.js';
import { lerp, clamp } from '../util/math.js';
import { createRng } from '../util/rng.js';

const STEP = 8;
const COLUMNS = Math.ceil(VIEW.width / STEP) + 3;
const TEXTURE_SPAN = 3200;

/**
 * Draws the wave.
 *
 * The crest and trough are sampled once per frame into flat arrays; every
 * other line on the face (glass striations, foam bands, the barrel roof) is
 * just a lerp between those two arrays, so the whole wave stays coherent no
 * matter how it swells.
 */
export class WaveRenderer {
  constructor(seed = 8675309) {
    const rng = createRng(seed);

    this.xs = Array.from({ length: COLUMNS }, (_, i) => i * STEP - STEP);
    this.crest = new Float32Array(COLUMNS);
    this.trough = new Float32Array(COLUMNS);

    // Scrolling surface texture: sparkles on the face and foam on the flats.
    this.sparkles = Array.from({ length: 190 }, () => ({
      worldX: rng.range(0, TEXTURE_SPAN),
      h: rng.range(0.06, 0.97),
      size: rng.range(0.9, 2.6),
      phase: rng.range(0, 7),
    }));

    this.flatFoam = Array.from({ length: 46 }, () => ({
      worldX: rng.range(0, TEXTURE_SPAN),
      y: rng.range(2, 70),
      width: rng.range(18, 76),
      alpha: rng.range(0.12, 0.4),
    }));

    this.glassLines = [0.94, 0.88, 0.81, 0.73, 0.65, 0.56, 0.47, 0.38, 0.29, 0.2, 0.11].map((h, i) => ({
      h,
      alpha: 0.16 + (i % 3) * 0.09,
      width: 1.4 + (i % 3) * 1.8,
    }));
  }

  /** Refresh the crest/trough sample arrays for this frame. */
  sample(wave) {
    let crestTotal = 0;
    let troughTotal = 0;
    for (let i = 0; i < COLUMNS; i += 1) {
      const x = this.xs[i];
      this.crest[i] = wave.crestAt(x);
      this.trough[i] = wave.troughAt(x);
      crestTotal += this.crest[i];
      troughTotal += this.trough[i];
    }
    // Gradients are vertical, so they key off the average height of each line
    // rather than whatever the leftmost column happens to be doing.
    this.crestAvg = crestTotal / COLUMNS;
    this.troughAvg = troughTotal / COLUMNS;
  }

  yAt(i, h) {
    return lerp(this.trough[i], this.crest[i], h);
  }

  /** Trace a constant-height line across the wave into the current path. */
  traceLine(ctx, h, offset = 0) {
    ctx.beginPath();
    for (let i = 0; i < COLUMNS; i += 1) {
      const y = this.yAt(i, h) + offset;
      if (i === 0) { ctx.moveTo(this.xs[i], y); } else { ctx.lineTo(this.xs[i], y); }
    }
  }

  /** Close a traced line down to the bottom of the world to make a fillable shape. */
  closeDown(ctx, bottom) {
    ctx.lineTo(this.xs[COLUMNS - 1], bottom);
    ctx.lineTo(this.xs[0], bottom);
    ctx.closePath();
  }

  drawFace(ctx, wave, { time, camY }) {
    this.sample(wave);
    const bottom = VIEW.height + Math.abs(camY) + 220;

    // Body of the wave.
    this.traceLine(ctx, 1);
    this.closeDown(ctx, bottom);
    const body = ctx.createLinearGradient(0, this.crestAvg - 10, 0, this.troughAvg + 90);
    body.addColorStop(0, PALETTE.faceTop);
    body.addColorStop(0.16, '#22b0bd');
    body.addColorStop(0.52, PALETTE.faceMid);
    body.addColorStop(1, PALETTE.faceDeep);
    ctx.fillStyle = body;
    ctx.fill();

    this.drawLipGlow(ctx);
    this.drawGlass(ctx);
    this.drawSparkles(ctx, wave, time);
    this.drawCrestFoam(ctx, wave, time);
    this.drawFlats(ctx, wave, bottom);
  }

  /** The backlit band just under the lip where the wave goes translucent. */
  drawLipGlow(ctx) {
    ctx.save();
    this.traceLine(ctx, 1);
    for (let i = COLUMNS - 1; i >= 0; i -= 1) {
      ctx.lineTo(this.xs[i], this.yAt(i, 1) + 46);
    }
    ctx.closePath();
    ctx.clip();

    const glow = ctx.createLinearGradient(0, this.crestAvg - 6, 0, this.crestAvg + 52);
    glow.addColorStop(0, 'rgba(196, 255, 245, 0.85)');
    glow.addColorStop(0.4, 'rgba(140, 240, 231, 0.42)');
    glow.addColorStop(1, 'rgba(120, 226, 226, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-40, this.crestAvg - 90, VIEW.width + 80, 260);
    ctx.restore();
  }

  drawGlass(ctx) {
    ctx.lineCap = 'round';
    for (const line of this.glassLines) {
      this.traceLine(ctx, line.h);
      ctx.strokeStyle = PALETTE.faceGlass;
      ctx.globalAlpha = line.alpha;
      ctx.lineWidth = line.width;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawSparkles(ctx, wave, time) {
    ctx.fillStyle = 'rgba(226, 255, 255, 0.75)';
    for (const sparkle of this.sparkles) {
      let x = (sparkle.worldX - wave.scroll) % TEXTURE_SPAN;
      if (x < 0) { x += TEXTURE_SPAN; }
      if (x > VIEW.width + 20) { continue; }
      const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(time * 3 + sparkle.phase));
      ctx.globalAlpha = twinkle * 0.5;
      ctx.fillRect(x, wave.yAt(x, sparkle.h), sparkle.size * 2.4, sparkle.size * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  drawCrestFoam(ctx, wave, time) {
    // Whitewater feathering down the back of the lip.
    ctx.save();
    this.traceLine(ctx, 1);
    ctx.strokeStyle = PALETTE.foam;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.strokeStyle = PALETTE.foamShade;
    ctx.lineWidth = 2;
    this.traceLine(ctx, 1, 6);
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Blobs give the foam line its irregular, boiling edge.
    ctx.fillStyle = PALETTE.foam;
    for (let i = 0; i < COLUMNS; i += 1) {
      const x = this.xs[i];
      const wobble = Math.sin((x + wave.scroll) * 0.055) + Math.sin((x + wave.scroll) * 0.021 + 2.1);
      const r = 4.6 + wobble * 2.1;
      if (r <= 0.6) { continue; }
      const bounce = Math.sin(time * 5 + x * 0.03) * 1.2;
      ctx.beginPath();
      ctx.arc(x, this.yAt(i, 1) - 1 + bounce, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The flat water in front of the wave, scrolling faster than the face. */
  drawFlats(ctx, wave, bottom) {
    ctx.save();
    this.traceLine(ctx, 0);
    this.closeDown(ctx, bottom);
    const flat = ctx.createLinearGradient(0, this.troughAvg, 0, this.troughAvg + 120);
    flat.addColorStop(0, 'rgba(4, 52, 68, 0.55)');
    flat.addColorStop(1, 'rgba(2, 30, 43, 0.92)');
    ctx.fillStyle = flat;
    ctx.fill();
    ctx.clip();

    ctx.fillStyle = PALETTE.foam;
    for (const streak of this.flatFoam) {
      let x = (streak.worldX - wave.scroll * 1.35) % TEXTURE_SPAN;
      if (x < 0) { x += TEXTURE_SPAN; }
      if (x > VIEW.width + 80) { continue; }
      ctx.globalAlpha = streak.alpha;
      ctx.fillRect(x, wave.troughAt(x) + streak.y, streak.width, 2.2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * The pitching lip of a barrel section, drawn on top of everything so the
   * surfer is genuinely behind the curtain of water.
   */
  drawBarrel(ctx, wave, { time }) {
    const intensity = wave.barrelIntensity();
    if (intensity <= 0.001) { return; }

    // How far the lip has thrown forward down the face. Shallow enough that
    // the pocket sits at the curtain's edge instead of buried behind it, and
    // deeper on the left so the tube reads as closing out behind you.
    const depth = (x) => intensity * (
      36 + 46 * (1 - clamp(x / VIEW.width, 0, 1)) + 16 * Math.sin((x + wave.scroll) * 0.0055 + 1.2)
    );
    const edgeAt = (i) => this.yAt(i, 1) + depth(this.xs[i]);
    const edgeAvg = this.crestAvg + intensity * 59;

    /** Trace the curl's leading edge left to right. */
    const traceEdge = () => {
      ctx.beginPath();
      for (let i = 0; i < COLUMNS; i += 1) {
        const y = edgeAt(i);
        if (i === 0) { ctx.moveTo(this.xs[i], y); } else { ctx.lineTo(this.xs[i], y); }
      }
    };

    // 1. The mouth of the tube: everything under the curl falls into shadow.
    ctx.save();
    traceEdge();
    for (let i = COLUMNS - 1; i >= 0; i -= 1) { ctx.lineTo(this.xs[i], edgeAt(i) + 210); }
    ctx.closePath();
    const shade = ctx.createLinearGradient(0, edgeAvg - 4, 0, edgeAvg + 200);
    shade.addColorStop(0, `rgba(2, 30, 43, ${0.88 * intensity})`);
    shade.addColorStop(0.45, `rgba(2, 34, 48, ${0.4 * intensity})`);
    shade.addColorStop(1, 'rgba(2, 34, 48, 0)');
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.restore();

    // 2. The curtain of falling water, thick at the top and sheer at the edge.
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < COLUMNS; i += 1) { ctx.lineTo(this.xs[i], this.yAt(i, 1) - 26); }
    for (let i = COLUMNS - 1; i >= 0; i -= 1) { ctx.lineTo(this.xs[i], edgeAt(i)); }
    ctx.closePath();
    ctx.clip();

    const curtain = ctx.createLinearGradient(0, this.crestAvg - 30, 0, edgeAvg + 6);
    curtain.addColorStop(0, 'rgba(247, 254, 255, 0.96)');
    curtain.addColorStop(0.38, 'rgba(198, 248, 249, 0.72)');
    curtain.addColorStop(0.76, 'rgba(128, 224, 232, 0.34)');
    curtain.addColorStop(1, 'rgba(86, 200, 216, 0.16)');
    ctx.fillStyle = curtain;
    ctx.fillRect(-40, this.crestAvg - 90, VIEW.width + 80, 320);

    // Streaks running down the sheet so it reads as moving water.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < COLUMNS; i += 3) {
      const x = this.xs[i];
      const seed = Math.sin((x + wave.scroll) * 0.09) * Math.sin((x + wave.scroll) * 0.031 + 1.4);
      if (seed < 0.12) { continue; }
      const top = this.yAt(i, 1) - 18;
      ctx.globalAlpha = 0.16 + seed * 0.4;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + 4, top + 30 + seed * 50);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Looking down the line: the further into the tube, the darker it gets.
    const tube = ctx.createLinearGradient(0, 0, VIEW.width * 0.7, 0);
    tube.addColorStop(0, `rgba(4, 44, 60, ${0.55 * intensity})`);
    tube.addColorStop(1, 'rgba(4, 44, 60, 0)');
    ctx.fillStyle = tube;
    ctx.fillRect(-40, this.crestAvg - 90, VIEW.width + 80, 320);
    ctx.restore();

    // 3. A bright rim on the throwing edge, backlit by the sun behind the wave.
    ctx.save();
    traceEdge();
    ctx.strokeStyle = 'rgba(214, 255, 252, 0.75)';
    ctx.lineWidth = 10 * intensity;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // 4. Boiling foam along that edge.
    ctx.fillStyle = PALETTE.foam;
    for (let i = 0; i < COLUMNS; i += 1) {
      const x = this.xs[i];
      const wobble = Math.sin((x + wave.scroll) * 0.05 + time * 3) + Math.sin((x + wave.scroll) * 0.017);
      const r = (6.5 + wobble * 2.4) * intensity;
      if (r <= 0.5) { continue; }
      ctx.beginPath();
      ctx.arc(x, edgeAt(i) - 2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Darkens the frame while you're deep in the pocket. */
  drawBarrelVignette(ctx, strength) {
    if (strength <= 0.01) { return; }
    const gradient = ctx.createRadialGradient(
      VIEW.width * 0.42, VIEW.height * 0.5, VIEW.height * 0.18,
      VIEW.width * 0.42, VIEW.height * 0.5, VIEW.height * 0.95,
    );
    gradient.addColorStop(0, 'rgba(4, 40, 54, 0)');
    gradient.addColorStop(1, `rgba(3, 28, 40, ${clamp(strength, 0, 1) * 0.72})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}
