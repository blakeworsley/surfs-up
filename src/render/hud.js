import { VIEW, PALETTE, SURFER, BARREL } from '../config.js';
import { TOUCH_ZONES } from '../input.js';
import { clamp, damp } from '../util/math.js';
import {
  UI_FONT, DISPLAY_FONT, panel, text, keyCap, meter, chip, roundRect,
  speakerIcon, timerRing, easeOutBack, easeOutCubic, intro,
} from './ui.js';

const CONTROL_ROWS = [
  { keys: ['↑', '↓'], label: 'climb and drop the wave face' },
  { keys: ['SPACE'], label: 'launch off the lip · hold to grab' },
  { keys: ['←', '→'], label: 'spin in the air — land facing forward' },
];

const TOUCH_ROWS = [
  { glyph: '▲ ▼', label: 'move up and down the wave' },
  { glyph: 'AIR', label: 'launch off the lip' },
  { glyph: '↺ ↻', label: 'spin — land facing forward' },
];

export class Hud {
  constructor() {
    this.scoreShown = 0;
    this.lastTarget = 0;
    this.scorePunch = 0;
    this.comboIn = 0;
    this.comboPunch = 0;
    this.lastMultiplier = 1;
    this.bannerIn = 0;
    this.speedShown = 0;
  }

  reset() {
    this.scoreShown = 0;
    this.lastTarget = 0;
    this.scorePunch = 0;
    this.comboIn = 0;
    this.comboPunch = 0;
    this.lastMultiplier = 1;
    this.bannerIn = 0;
  }

  /**
   * Drives the HUD's own animation. Score counts up rather than snapping, and
   * a big jump (a landed trick) punches the number so points feel earned.
   */
  update(dt, { score = 0, multiplier = 1, inBarrel = false, speedNorm = 0 } = {}) {
    const gap = score - this.scoreShown;
    this.scoreShown += gap * clamp(dt * 9, 0, 1);
    if (Math.abs(gap) < 1) { this.scoreShown = score; }

    if (score - this.lastTarget > 60) { this.scorePunch = 1; }
    this.lastTarget = score;
    this.scorePunch = Math.max(0, this.scorePunch - dt * 3.2);

    if (multiplier > this.lastMultiplier) { this.comboPunch = 1; }
    this.lastMultiplier = multiplier;
    this.comboPunch = Math.max(0, this.comboPunch - dt * 2.6);
    this.comboIn = damp(this.comboIn, multiplier > 1 ? 1 : 0, 9, dt);

    this.bannerIn = damp(this.bannerIn, inBarrel ? 1 : 0, 8, dt);
    this.speedShown = damp(this.speedShown, speedNorm, 7, dt);
  }

  draw(ctx, state) {
    const fade = state.hudFade ?? 1;

    // The readouts step aside for the results and pause panels — the panel is
    // saying the same things, louder.
    if (fade > 0.01) {
      ctx.save();
      ctx.globalAlpha = fade;
      this.drawTopScrim(ctx);
      this.drawScore(ctx, state);
      this.drawCombo(ctx);
      if (this.bannerIn > 0.01) { this.drawBarrelBanner(ctx, state); }
      if (state.tutorial && fade > 0.9) { this.drawTutorial(ctx, state); }
      ctx.restore();
    }

    // Sound stays reachable on every screen, including the title card.
    this.drawMute(ctx, state.muted, state.showTouch);
    // The buttons only do something while you are actually surfing.
    if (state.showTouch && fade > 0.5) { this.drawTouchControls(ctx, state); }
  }

  /**
   * A soft darkening at the very top. The sky runs from deep blue to near-white
   * at the horizon, and the camera pans; without this the score is legible in
   * some frames and not others.
   */
  drawTopScrim(ctx) {
    const scrim = ctx.createLinearGradient(0, 0, 0, 140);
    scrim.addColorStop(0, 'rgba(3, 26, 38, 0.34)');
    scrim.addColorStop(1, 'rgba(3, 26, 38, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, VIEW.width, 140);
  }

  drawScore(ctx, { highScore }) {
    const punch = easeOutCubic(this.scorePunch);
    const size = 46 + punch * 9;

    ctx.save();
    ctx.translate(28, 58);
    text(ctx, String(Math.floor(this.scoreShown)).padStart(5, '0'), 0, 0, {
      size, font: DISPLAY_FONT, outline: 7, shadow: 10,
      color: punch > 0.05 ? '#ffe9a8' : PALETTE.hud,
    });
    ctx.restore();

    text(ctx, `BEST ${String(Math.floor(highScore)).padStart(5, '0')}`, 30, 84, {
      size: 18, color: 'rgba(230, 250, 255, 0.82)', outline: 5,
    });

    text(ctx, 'SPEED', 30, 106, {
      size: 11, color: 'rgba(214, 244, 255, 0.6)', weight: '800', letterSpacing: 1.4, outline: 4,
    });
    meter(ctx, 82, 97, 88, 8, this.speedShown);
  }

  drawCombo(ctx) {
    if (this.comboIn < 0.01) { return; }

    const punch = easeOutCubic(this.comboPunch);
    const scale = this.comboIn * (1 + punch * 0.22);
    const x = VIEW.width - 30;

    ctx.save();
    ctx.globalAlpha = clamp(this.comboIn, 0, 1);
    ctx.translate(x, 48);
    ctx.scale(scale, scale);

    // A ring that flares outward each time the multiplier steps up.
    if (punch > 0.02) {
      ctx.save();
      ctx.globalAlpha = punch * 0.5;
      ctx.beginPath();
      ctx.arc(-34, 4, 30 + (1 - punch) * 34, 0, Math.PI * 2);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    text(ctx, `x${this.lastMultiplier.toFixed(1)}`, 0, 0, {
      size: 40, font: DISPLAY_FONT, align: 'right', color: PALETTE.gold, outline: 7, shadow: 8,
    });
    text(ctx, 'COMBO', 0, 22, {
      size: 14, align: 'right', color: 'rgba(255, 226, 150, 0.9)', outline: 4, letterSpacing: 2,
    });
    ctx.restore();
  }

  drawBarrelBanner(ctx, { wave, surfer }) {
    const inPocket = wave.inPocket(surfer.h);
    const ease = easeOutCubic(this.bannerIn);
    const remaining = wave.barrel
      ? 1 - wave.barrel.elapsed / wave.barrel.duration
      : 0;

    ctx.save();
    ctx.globalAlpha = ease;
    ctx.translate(0, -26 * (1 - ease));

    text(ctx, inPocket ? 'IN THE BARREL!' : 'FIND THE POCKET', VIEW.width / 2, 62, {
      size: 34, font: DISPLAY_FONT, align: 'center',
      color: inPocket ? PALETTE.gold : PALETTE.hud, outline: 7, shadow: 10,
    });

    // Where the pocket is, and where you are relative to it.
    const x = VIEW.width / 2 - 90;
    const y = 78;
    roundRect(ctx, x, y, 180, 10, 5);
    ctx.fillStyle = 'rgba(4, 33, 46, 0.65)';
    ctx.fill();

    const low = BARREL.pocketLow * 180;
    const high = BARREL.pocketHigh * 180;
    roundRect(ctx, x + low, y, high - low, 10, 5);
    ctx.fillStyle = 'rgba(255, 212, 101, 0.78)';
    ctx.fill();

    const marker = x + clamp(surfer.h, 0, 1) * 180;
    ctx.save();
    if (inPocket) {
      ctx.shadowColor = 'rgba(255, 212, 101, 0.9)';
      ctx.shadowBlur = 12;
    }
    ctx.beginPath();
    ctx.arc(marker, y + 5, 7, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.hud;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // How long the section has left to run.
    timerRing(ctx, x - 22, y + 5, 11, remaining);
    ctx.restore();
  }

  /** First few runs only: name the one control that isn't self-evident. */
  drawTutorial(ctx, { surfer, wave, time, showTouch }) {
    if (surfer.mode !== 'riding' || wave.inBarrel) { return; }
    if (surfer.h < SURFER.launchMinH) { return; }

    const pulse = 0.55 + 0.45 * Math.sin(time * 6);
    ctx.save();
    ctx.globalAlpha = pulse;
    // There is no space bar on a phone.
    const hint = showTouch ? 'TAP AIR' : 'SPACE = AIR';
    text(ctx, hint, surfer.x + 30, Math.max(surfer.y - 78, 128), {
      size: 20, align: 'center', color: PALETTE.gold, outline: 6,
    });
    ctx.restore();
  }

  drawMute(ctx, muted, showTouch) {
    const zone = TOUCH_ZONES.mute;
    speakerIcon(ctx, zone.x, zone.y, muted, { alpha: 0.72 });
    // The keyboard hint is noise on a device without one — there it is a
    // tap target instead.
    if (!showTouch) {
      text(ctx, 'M', zone.x, zone.y + 26, {
        size: 12, align: 'center', color: 'rgba(230, 250, 255, 0.62)',
      });
    }
  }

  /**
   * On-screen controls. Held buttons brighten and shrink slightly — without
   * that feedback there's no way to tell a touch registered.
   */
  drawTouchControls(ctx, { surfer, activeZones }) {
    const airborne = surfer.mode === 'air';
    const held = activeZones || new Set();

    for (const [name, zone] of Object.entries(TOUCH_ZONES)) {
      if (name === 'mute') { continue; }
      const spinner = name === 'left' || name === 'right';
      if (spinner && !airborne) { continue; }

      const down = held.has(name);
      const radius = zone.radius * (down ? 0.94 : 1);

      ctx.save();
      if (down) {
        ctx.shadowColor = 'rgba(126, 231, 255, 0.7)';
        ctx.shadowBlur = 18;
      }
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = down ? 'rgba(126, 231, 255, 0.34)' : 'rgba(4, 33, 46, 0.32)';
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(zone.x, zone.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = down ? 'rgba(206, 246, 255, 0.95)' : 'rgba(246, 254, 255, 0.5)';
      ctx.lineWidth = down ? 3.5 : 2.5;
      ctx.stroke();

      const glyph = name === 'action' && airborne ? 'GRAB' : zone.glyph;
      text(ctx, glyph, zone.x, zone.y + (glyph.length > 2 ? 7 : 10), {
        size: glyph.length > 2 ? 17 : 27,
        align: 'center',
        color: down ? '#ffffff' : 'rgba(246, 254, 255, 0.92)',
      });
    }
  }

  // --- Full screen states --------------------------------------------------

  drawTitle(ctx, { elapsed, highScore, bestTrick, showTouch, fade = 1 }) {
    ctx.save();
    ctx.globalAlpha = fade;

    ctx.fillStyle = 'rgba(3, 26, 38, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    // The lip drifts through the title block, so the type gets its own scrim
    // rather than relying on the foam being somewhere else this frame.
    const scrim = ctx.createLinearGradient(0, 60, 0, 240);
    scrim.addColorStop(0, 'rgba(3, 26, 38, 0)');
    scrim.addColorStop(0.45, 'rgba(3, 26, 38, 0.55)');
    scrim.addColorStop(1, 'rgba(3, 26, 38, 0)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 60, VIEW.width, 180);

    const bob = Math.sin(elapsed * 1.6) * 5;

    // Title drops in with a slight overshoot.
    const titleT = intro(elapsed, 0, 0.5);
    ctx.save();
    ctx.globalAlpha = fade * titleT;
    ctx.translate(0, (1 - easeOutBack(titleT)) * -40);
    text(ctx, "SURF'S UP", VIEW.width / 2, 168 + bob, {
      size: 92, font: DISPLAY_FONT, align: 'center', outline: 12, shadow: 18,
    });
    ctx.restore();

    const tagT = intro(elapsed, 0.18);
    ctx.globalAlpha = fade * tagT;
    text(ctx, 'ride the face · dodge the crowd · boost the lip', VIEW.width / 2, 204 + bob, {
      size: 22, align: 'center', color: 'rgba(214, 246, 255, 0.92)', outline: 5,
    });

    const cardT = intro(elapsed, 0.32);
    ctx.globalAlpha = fade * cardT;
    ctx.save();
    ctx.translate(0, (1 - easeOutCubic(cardT)) * 22);
    panel(ctx, VIEW.width / 2 - 268, 236, 536, 172);
    this.drawControlList(ctx, showTouch, elapsed, fade);
    ctx.restore();
    ctx.globalAlpha = fade;

    const promptT = intro(elapsed, 0.5);
    const flash = 0.76 + 0.24 * Math.sin(elapsed * 4);
    ctx.globalAlpha = fade * promptT * flash;
    text(ctx, showTouch ? 'TAP TO PADDLE OUT' : 'PRESS SPACE TO PADDLE OUT', VIEW.width / 2, 454, {
      size: 30, font: DISPLAY_FONT, align: 'center', color: PALETTE.gold, outline: 7, shadow: 10,
    });

    ctx.globalAlpha = fade * promptT;
    if (highScore > 0) {
      const label = bestTrick ? `BEST ${Math.floor(highScore)} · ${bestTrick}` : `BEST ${Math.floor(highScore)}`;
      chip(ctx, VIEW.width / 2, 474, label, { align: 'center', size: 17 });
    }
    ctx.restore();
  }

  drawControlList(ctx, showTouch, elapsed, fade) {
    if (showTouch) {
      TOUCH_ROWS.forEach((row, i) => {
        const rowT = intro(elapsed, 0.4 + i * 0.08);
        ctx.globalAlpha = fade * rowT;
        const y = 278 + i * 44;
        text(ctx, row.glyph, VIEW.width / 2 - 168, y, {
          size: 24, align: 'center', color: PALETTE.gold,
        });
        text(ctx, row.label, VIEW.width / 2 - 118, y, {
          size: 20, color: 'rgba(226, 248, 255, 0.94)',
        });
      });
      return;
    }

    CONTROL_ROWS.forEach((row, i) => {
      const rowT = intro(elapsed, 0.4 + i * 0.08);
      ctx.globalAlpha = fade * rowT;
      const y = 262 + i * 48;
      let x = VIEW.width / 2 - 232;
      for (const key of row.keys) {
        const width = key.length > 2 ? 76 : 42;
        keyCap(ctx, x, y, key, { width });
        x += width + 8;
      }
      text(ctx, row.label, VIEW.width / 2 - 96, y + 24, {
        size: 20, color: 'rgba(226, 248, 255, 0.94)',
      });
    });
  }

  /**
   * The results panel. Showing where the points came from turns a number into
   * feedback: you can see whether the run was distance, tricks or barrels.
   */
  drawGameOver(ctx, state) {
    const { elapsed, score, highScore, reason, breakdown, beatHighScore, showTouch } = state;
    const fade = clamp(elapsed / 0.35, 0, 1);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(3, 26, 38, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const pop = easeOutBack(clamp(elapsed / 0.42, 0, 1), 1.1);
    ctx.save();
    ctx.translate(VIEW.width / 2, 286);
    ctx.scale(0.9 + pop * 0.1, 0.9 + pop * 0.1);
    ctx.translate(-VIEW.width / 2, -286);

    panel(ctx, VIEW.width / 2 - 254, 124, 508, 338);

    text(ctx, 'WIPEOUT', VIEW.width / 2, 190, {
      size: 62, font: DISPLAY_FONT, align: 'center', color: PALETTE.danger, shadow: 14,
    });
    text(ctx, reason, VIEW.width / 2, 220, {
      size: 20, align: 'center', color: 'rgba(226, 248, 255, 0.88)',
    });

    // Total, counting up from zero.
    const countT = easeOutCubic(clamp((elapsed - 0.2) / 0.7, 0, 1));
    text(ctx, String(Math.floor(score * countT)), VIEW.width / 2, 286, {
      size: 62, font: DISPLAY_FONT, align: 'center', shadow: 10,
    });
    text(ctx, 'TOTAL', VIEW.width / 2, 306, {
      size: 13, align: 'center', color: 'rgba(226, 248, 255, 0.6)', letterSpacing: 2,
    });

    this.drawBreakdown(ctx, breakdown, elapsed);

    const bestT = intro(elapsed, 0.8);
    ctx.globalAlpha = fade * bestT;

    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2 - 210, 414);
    ctx.lineTo(VIEW.width / 2 + 210, 414);
    ctx.strokeStyle = 'rgba(174, 236, 249, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (beatHighScore) {
      const pulse = 0.7 + 0.3 * Math.sin(elapsed * 7);
      ctx.globalAlpha = fade * bestT * pulse;
      text(ctx, 'NEW PERSONAL BEST!', VIEW.width / 2, 444, {
        size: 26, font: DISPLAY_FONT, align: 'center', color: PALETTE.gold,
      });
    } else {
      const behind = Math.max(0, Math.floor(highScore) - Math.floor(score));
      text(ctx, `BEST ${Math.floor(highScore)}${behind ? `  ·  ${behind} away` : ''}`, VIEW.width / 2, 442, {
        size: 21, align: 'center', color: 'rgba(226, 248, 255, 0.82)',
      });
    }
    ctx.restore();

    const promptT = intro(elapsed, 0.95);
    const flash = 0.76 + 0.24 * Math.sin(elapsed * 4);
    ctx.globalAlpha = fade * promptT * flash;
    text(ctx, showTouch ? 'TAP TO PADDLE BACK OUT' : 'PRESS SPACE TO PADDLE BACK OUT', VIEW.width / 2, 502, {
      size: 27, font: DISPLAY_FONT, align: 'center', color: PALETTE.gold, outline: 7, shadow: 10,
    });
    ctx.restore();
  }

  drawBreakdown(ctx, breakdown, elapsed) {
    if (!breakdown) { return; }

    const rows = [
      { label: 'DISTANCE', detail: `${Math.round(breakdown.metres)}m`, points: breakdown.distancePoints },
      {
        label: 'TRICKS',
        detail: breakdown.landedTricks
          ? `${breakdown.landedTricks}×  ${breakdown.bestTrick || ''}`.trim()
          : 'none landed',
        points: breakdown.trickScore,
      },
      {
        label: 'BARREL',
        detail: breakdown.barrelTime > 0.1 ? `${breakdown.barrelTime.toFixed(1)}s in the tube` : 'no sections',
        points: breakdown.barrelScore,
      },
    ];

    rows.forEach((row, i) => {
      const rowT = intro(elapsed, 0.45 + i * 0.1);
      if (rowT <= 0) { return; }

      ctx.save();
      ctx.globalAlpha = rowT;
      ctx.translate((1 - easeOutCubic(rowT)) * -16, 0);
      const y = 342 + i * 26;
      const dim = row.points === 0;

      text(ctx, row.label, VIEW.width / 2 - 210, y, {
        size: 13, color: dim ? 'rgba(226, 248, 255, 0.35)' : 'rgba(255, 212, 101, 0.9)',
        letterSpacing: 1.6,
      });
      text(ctx, row.detail, VIEW.width / 2 - 118, y, {
        size: 15, color: dim ? 'rgba(226, 248, 255, 0.35)' : 'rgba(226, 248, 255, 0.78)',
      });
      text(ctx, `+${row.points}`, VIEW.width / 2 + 210, y, {
        size: 17, align: 'right',
        color: dim ? 'rgba(226, 248, 255, 0.3)' : PALETTE.hud,
      });
      ctx.restore();
    });
  }

  drawPaused(ctx, { showTouch }) {
    ctx.fillStyle = 'rgba(3, 26, 38, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    text(ctx, 'PAUSED', VIEW.width / 2, 214, {
      size: 64, font: DISPLAY_FONT, align: 'center', shadow: 14,
    });

    panel(ctx, VIEW.width / 2 - 268, 250, 536, 172);
    this.drawControlList(ctx, showTouch, 99, 1);

    text(ctx, showTouch ? 'tap to keep surfing' : 'press P or SPACE to keep surfing', VIEW.width / 2, 460, {
      size: 22, align: 'center', color: 'rgba(226, 248, 255, 0.88)', outline: 5,
    });
  }
}
