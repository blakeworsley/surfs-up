import { VIEW, PALETTE, SURFER, BARREL } from '../config.js';
import { TOUCH_ZONES } from '../input.js';
import { clamp } from '../util/math.js';

const UI = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
const DISPLAY = '"Righteous", "Baloo 2", "Trebuchet MS", system-ui, sans-serif';

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, width, height, { radius = 22, alpha = 0.72 } = {}) {
  roundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = `rgba(4, 33, 46, ${alpha})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(180, 240, 250, 0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function text(ctx, value, x, y, { size = 24, color = PALETTE.hud, weight = '700', align = 'left', font = UI, outline = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (outline) {
    ctx.lineWidth = outline;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4, 33, 46, 0.85)';
    ctx.strokeText(value, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function keyCap(ctx, x, y, label, { width = 42, height = 34, active = false } = {}) {
  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = active ? 'rgba(126, 231, 255, 0.9)' : 'rgba(246, 254, 255, 0.14)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(246, 254, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, label, x + width / 2, y + height / 2 + 6, {
    size: label.length > 2 ? 15 : 18,
    align: 'center',
    color: active ? '#052a38' : PALETTE.hud,
    weight: '700',
  });
}

export class Hud {
  constructor() {
    this.scoreShown = 0;
  }

  /** Score counts up smoothly rather than snapping — it reads better. */
  update(dt, target) {
    const gap = target - this.scoreShown;
    this.scoreShown += gap * clamp(dt * 9, 0, 1);
    if (Math.abs(gap) < 1) { this.scoreShown = target; }
  }

  draw(ctx, state) {
    const { score, highScore, multiplier, wave, surfer, muted, speedNorm, tutorial } = state;

    text(ctx, String(Math.floor(this.scoreShown)).padStart(5, '0'), 28, 58, {
      size: 46, font: DISPLAY, outline: 7,
    });
    text(ctx, `BEST ${String(Math.floor(highScore)).padStart(5, '0')}`, 30, 84, {
      size: 18, color: 'rgba(230, 250, 255, 0.8)', outline: 5,
    });

    // Speed bar.
    roundRect(ctx, 30, 96, 132, 7, 4);
    ctx.fillStyle = 'rgba(4, 33, 46, 0.5)';
    ctx.fill();
    roundRect(ctx, 30, 96, 132 * clamp(speedNorm, 0, 1), 7, 4);
    ctx.fillStyle = speedNorm > 0.8 ? PALETTE.gold : '#7ee7ff';
    ctx.fill();

    if (multiplier > 1) {
      text(ctx, `x${multiplier.toFixed(1)}`, VIEW.width - 30, 58, {
        size: 40, font: DISPLAY, align: 'right', color: PALETTE.gold, outline: 7,
      });
      text(ctx, 'COMBO', VIEW.width - 30, 80, {
        size: 15, align: 'right', color: 'rgba(255, 226, 150, 0.85)', outline: 4,
      });
    }

    if (wave.inBarrel) { this.drawBarrelBanner(ctx, wave, surfer); }
    if (tutorial) { this.drawTutorial(ctx, state); }

    this.drawMute(ctx, muted);
    if (state.showTouch) { this.drawTouchControls(ctx, state); }
  }

  drawBarrelBanner(ctx, wave, surfer) {
    const intensity = wave.barrelIntensity();
    const inPocket = wave.inPocket(surfer.h);
    ctx.globalAlpha = intensity;

    const label = inPocket ? 'IN THE BARREL!' : 'FIND THE POCKET';
    text(ctx, label, VIEW.width / 2, 66, {
      size: 34, font: DISPLAY, align: 'center',
      color: inPocket ? PALETTE.gold : PALETTE.hud, outline: 7,
    });

    // A little gauge of where the pocket is, and where you are in it.
    const x = VIEW.width / 2 - 90;
    const y = 82;
    roundRect(ctx, x, y, 180, 10, 5);
    ctx.fillStyle = 'rgba(4, 33, 46, 0.6)';
    ctx.fill();

    const low = BARREL.pocketLow * 180;
    const high = BARREL.pocketHigh * 180;
    roundRect(ctx, x + low, y, high - low, 10, 5);
    ctx.fillStyle = 'rgba(255, 212, 101, 0.75)';
    ctx.fill();

    const marker = x + clamp(surfer.h, 0, 1) * 180;
    ctx.beginPath();
    ctx.arc(marker, y + 5, 7, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.hud;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** First couple of runs: point out the one thing that isn't obvious. */
  drawTutorial(ctx, { surfer, wave, time }) {
    if (surfer.mode !== 'riding' || wave.inBarrel) { return; }
    if (surfer.h < SURFER.launchMinH) { return; }

    const pulse = 0.55 + 0.45 * Math.sin(time * 6);
    ctx.globalAlpha = pulse;
    // Kept clear of the score block when the surfer is right up on the lip.
    text(ctx, 'SPACE = AIR', surfer.x + 30, Math.max(surfer.y - 78, 128), {
      size: 20, align: 'center', color: PALETTE.gold, outline: 6,
    });
    ctx.globalAlpha = 1;
  }

  /** A hand-drawn speaker: emoji render inconsistently across platforms. */
  drawMute(ctx, muted) {
    const x = VIEW.width - 38;
    const y = VIEW.height - 38;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.translate(x, y);
    ctx.strokeStyle = PALETTE.hud;
    ctx.fillStyle = PALETTE.hud;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(-4, -4);
    ctx.lineTo(2, -10);
    ctx.lineTo(2, 10);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-9, 4);
    ctx.closePath();
    ctx.fill();

    if (muted) {
      ctx.strokeStyle = PALETTE.danger;
      ctx.beginPath();
      ctx.moveTo(6, -6);
      ctx.lineTo(14, 6);
      ctx.moveTo(14, -6);
      ctx.lineTo(6, 6);
      ctx.stroke();
    } else {
      for (let i = 1; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.arc(2, 0, 4 + i * 4, -0.9, 0.9);
        ctx.stroke();
      }
    }

    text(ctx, 'M', 0, 26, { size: 12, align: 'center', color: 'rgba(230, 250, 255, 0.7)' });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawTouchControls(ctx, { surfer }) {
    const airborne = surfer.mode === 'air';
    for (const [name, zone] of Object.entries(TOUCH_ZONES)) {
      const spinner = name === 'left' || name === 'right';
      if (spinner && !airborne) { continue; }

      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(4, 33, 46, 0.32)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(246, 254, 255, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const glyph = name === 'action' && airborne ? 'GRAB' : zone.glyph;
      text(ctx, glyph, zone.x, zone.y + (glyph.length > 2 ? 7 : 10), {
        size: glyph.length > 2 ? 17 : 27, align: 'center', color: 'rgba(246, 254, 255, 0.92)',
      });
    }
  }

  // --- Full screen states --------------------------------------------------

  drawTitle(ctx, { time, highScore, showTouch }) {
    ctx.fillStyle = 'rgba(3, 26, 38, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    // The lip drifts through the title block, so give the type its own scrim
    // rather than relying on the foam happening to be somewhere else.
    const scrim = ctx.createLinearGradient(0, 60, 0, 240);
    scrim.addColorStop(0, 'rgba(3, 26, 38, 0)');
    scrim.addColorStop(0.45, 'rgba(3, 26, 38, 0.55)');
    scrim.addColorStop(1, 'rgba(3, 26, 38, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 60, VIEW.width, 180);

    const bob = Math.sin(time * 1.6) * 5;

    text(ctx, "SURF'S UP", VIEW.width / 2, 168 + bob, {
      size: 92, font: DISPLAY, align: 'center', color: PALETTE.hud, outline: 12,
    });
    text(ctx, 'ride the face · dodge the crowd · boost the lip', VIEW.width / 2, 204 + bob, {
      size: 22, align: 'center', color: 'rgba(214, 246, 255, 0.9)', outline: 5,
    });

    panel(ctx, VIEW.width / 2 - 268, 236, 536, 168);

    if (showTouch) {
      text(ctx, 'TOUCH CONTROLS', VIEW.width / 2, 274, { size: 20, align: 'center', color: PALETTE.gold });
      text(ctx, '▲ ▼  move up and down the wave', VIEW.width / 2, 310, { size: 21, align: 'center' });
      text(ctx, 'AIR  launch off the lip', VIEW.width / 2, 342, { size: 21, align: 'center' });
      text(ctx, '↺ ↻  spin — land facing forward', VIEW.width / 2, 374, { size: 21, align: 'center' });
    } else {
      const rows = [
        { keys: ['↑', '↓'], label: 'climb and drop the wave face' },
        { keys: ['SPACE'], label: 'launch off the lip · hold to grab' },
        { keys: ['←', '→'], label: 'spin in the air — land facing forward' },
      ];
      rows.forEach((row, i) => {
        const y = 266 + i * 46;
        let x = VIEW.width / 2 - 232;
        for (const key of row.keys) {
          keyCap(ctx, x, y, key, { width: key.length > 2 ? 76 : 42 });
          x += (key.length > 2 ? 76 : 42) + 8;
        }
        text(ctx, row.label, VIEW.width / 2 - 96, y + 24, { size: 20, color: 'rgba(226, 248, 255, 0.92)' });
      });
    }

    const flash = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.globalAlpha = 0.55 + flash * 0.45;
    text(ctx, showTouch ? 'TAP TO PADDLE OUT' : 'PRESS SPACE TO PADDLE OUT', VIEW.width / 2, 452, {
      size: 30, font: DISPLAY, align: 'center', color: PALETTE.gold, outline: 7,
    });
    ctx.globalAlpha = 1;

    if (highScore > 0) {
      text(ctx, `BEST ${Math.floor(highScore)}`, VIEW.width / 2, 486, {
        size: 20, align: 'center', color: 'rgba(226, 248, 255, 0.8)', outline: 5,
      });
    }
  }

  drawGameOver(ctx, { time, score, highScore, reason, bestTrick, beatHighScore, showTouch, sinceOver }) {
    const fade = clamp(sinceOver / 0.4, 0, 1);
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(3, 26, 38, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    panel(ctx, VIEW.width / 2 - 250, 132, 500, 276);

    text(ctx, 'WIPEOUT', VIEW.width / 2, 200, {
      size: 66, font: DISPLAY, align: 'center', color: PALETTE.danger, outline: 9,
    });
    text(ctx, reason, VIEW.width / 2, 232, {
      size: 21, align: 'center', color: 'rgba(226, 248, 255, 0.9)',
    });

    text(ctx, String(Math.floor(score)), VIEW.width / 2, 306, {
      size: 62, font: DISPLAY, align: 'center', color: PALETTE.hud,
    });
    text(ctx, 'SCORE', VIEW.width / 2, 328, {
      size: 16, align: 'center', color: 'rgba(226, 248, 255, 0.65)',
    });

    if (beatHighScore) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 7);
      ctx.globalAlpha = fade * pulse;
      text(ctx, 'NEW PERSONAL BEST!', VIEW.width / 2, 360, {
        size: 26, font: DISPLAY, align: 'center', color: PALETTE.gold,
      });
      ctx.globalAlpha = fade;
    } else {
      text(ctx, `BEST ${Math.floor(highScore)}`, VIEW.width / 2, 358, {
        size: 22, align: 'center', color: 'rgba(226, 248, 255, 0.8)',
      });
    }

    if (bestTrick) {
      text(ctx, `Best trick this run: ${bestTrick}`, VIEW.width / 2, 388, {
        size: 18, align: 'center', color: 'rgba(255, 212, 101, 0.9)',
      });
    }

    const flash = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.globalAlpha = fade * (0.55 + flash * 0.45);
    text(ctx, showTouch ? 'TAP TO PADDLE BACK OUT' : 'PRESS SPACE TO PADDLE BACK OUT', VIEW.width / 2, 452, {
      size: 27, font: DISPLAY, align: 'center', color: PALETTE.gold, outline: 7,
    });
    ctx.globalAlpha = 1;
  }

  drawPaused(ctx) {
    ctx.fillStyle = 'rgba(3, 26, 38, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    text(ctx, 'PAUSED', VIEW.width / 2, VIEW.height / 2, {
      size: 64, font: DISPLAY, align: 'center', outline: 9,
    });
    text(ctx, 'press P to keep surfing', VIEW.width / 2, VIEW.height / 2 + 38, {
      size: 22, align: 'center', color: 'rgba(226, 248, 255, 0.85)', outline: 5,
    });
  }
}
