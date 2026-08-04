import { VIEW, SURFER, CAMERA, DIFFICULTY, BARREL, STORAGE_KEYS } from './config.js';
import { clamp, damp, ratio } from './util/math.js';
import { createRng } from './util/rng.js';
import { readNumber, write } from './util/storage.js';
import { Wave } from './wave.js';
import { Surfer, MODE } from './surfer.js';
import { ObstacleField } from './obstacles.js';
import { Particles, Popups } from './particles.js';
import { Scoreboard } from './scoring.js';
import { Audio } from './audio.js';
import { Scene } from './render/scene.js';
import { WaveRenderer } from './render/wave-renderer.js';
import { drawObstacle } from './render/characters.js';
import { drawSurfer, drawRotationDial } from './render/surfer-renderer.js';
import { Hud } from './render/hud.js';
import { NEUTRAL_INPUT } from './input.js';

export const STATE = {
  title: 'title',
  playing: 'playing',
  paused: 'paused',
  over: 'over',
};

const WIPEOUT_HOLD = 1.15; // seconds of tumbling before the panel appears

export class Game {
  constructor({ audio = new Audio(), seed = Date.now() } = {}) {
    this.rng = createRng(seed >>> 0);
    this.audio = audio;

    this.wave = new Wave();
    this.surfer = new Surfer();
    this.obstacles = new ObstacleField(this.rng);
    this.particles = new Particles();
    this.popups = new Popups();
    this.score = new Scoreboard();

    this.scene = new Scene();
    this.waveRenderer = new WaveRenderer();
    this.hud = new Hud();

    this.playCount = readNumber(STORAGE_KEYS.played, 0);
    this.state = STATE.title;
    this.time = 0;
    this.camY = 0;
    this.shake = 0;
    this.timeScale = 1;
    this.sinceOver = 0;
    this.reason = '';
    this.wipeoutTimer = 0;
    this.titlePhase = 0;
    // Seconds since the run began, used to cross-fade the title away.
    this.sinceStart = Infinity;
    // A wash of foam over the screen when a run starts.
    this.flash = 0;
    // Only the first paddle-out cross-fades from the title card; restarts
    // come from the results panel and should not flash it back up.
    this.fadingTitle = false;
    this.activeZones = new Set();
  }

  get difficulty() {
    return clamp(this.score.distance / DIFFICULTY.rampDistance, 0, 1);
  }

  get speedNorm() {
    const top = (SURFER.baseSpeed + SURFER.speedFromDifficulty) * SURFER.speedAtTrough;
    return ratio(this.surfer.speed, SURFER.baseSpeed * 0.85, top);
  }

  /** Show the "SPACE = AIR" nudge for a player's first few runs. */
  get tutorial() {
    return this.playCount < 3;
  }

  start() {
    this.fadingTitle = this.state === STATE.title;
    this.wave = new Wave();
    this.wave.nextBarrelAt = DIFFICULTY.barrelsAfter;
    this.surfer.reset();
    this.obstacles.reset();
    this.particles.clear();
    this.popups.clear();
    this.score.reset();
    this.hud.reset();
    this.camY = 0;
    this.shake = 0;
    this.timeScale = 1;
    this.sinceOver = 0;
    this.sinceStart = 0;
    this.flash = 1;
    this.wipeoutTimer = 0;
    this.reason = '';
    this.state = STATE.playing;

    this.playCount += 1;
    write(STORAGE_KEYS.played, this.playCount);
    this.audio.start();
  }

  // --- Update --------------------------------------------------------------

  update(dt, input = NEUTRAL_INPUT) {
    // Clamp dt so an alt-tabbed tab doesn't teleport the player into someone.
    const step = Math.min(dt, 1 / 30);

    if (input.mutePressed) { this.audio.toggleMute(); }
    if (input.zones) { this.activeZones = input.zones; }
    this.flash = Math.max(0, this.flash - dt * 3.4);

    switch (this.state) {
      case STATE.title:
        this.updateTitle(step, input);
        break;
      case STATE.playing:
        this.updatePlaying(step, input);
        break;
      case STATE.paused:
        this.time += step;
        if (input.pausePressed || input.startPressed) { this.state = STATE.playing; }
        break;
      case STATE.over:
        this.updateOver(step, input);
        break;
      default:
        break;
    }
  }

  /** The title screen is a live, unplayable demo of the wave. */
  updateTitle(dt, input) {
    this.time += dt;
    this.titlePhase += dt;

    const cruise = 210;
    this.wave.advance(cruise * dt);
    this.surfer.h = 0.5 + Math.sin(this.titlePhase * 0.8) * 0.28;
    // Parked off to the left so the demo rider stays clear of the title card.
    this.surfer.x = 132;
    this.surfer.speed = cruise;
    this.surfer.mode = MODE.riding;
    this.surfer.vh = Math.cos(this.titlePhase * 0.8) * 0.22;
    this.surfer.y = this.wave.yAt(this.surfer.x, this.surfer.h);

    this.particles.wake(this.rng, this.surfer.x - 26, this.surfer.y + 8, cruise, 1);
    this.emitLipMist(dt);
    this.particles.update(dt, cruise);
    this.hud.update(dt, {});

    if (input.startPressed) { this.start(); }
  }

  updatePlaying(dt, input) {
    this.sinceStart += dt;
    const wiping = this.surfer.mode === MODE.wipeout;

    if (input.pausePressed && !wiping) {
      this.state = STATE.paused;
      return;
    }

    this.updateTimeScale(dt, wiping);
    const scaled = dt * this.timeScale;
    this.time += scaled;

    this.wave.updateBarrel(scaled);
    const events = this.surfer.update(scaled, wiping ? NEUTRAL_INPUT : input, this.wave, this.difficulty);
    for (const event of events) { this.handleSurferEvent(event); }

    const travelled = this.surfer.speed * scaled;
    this.wave.advance(travelled);

    if (!wiping) {
      this.score.addDistance(travelled);
      this.maybeStartBarrel();
      this.scoreBarrel(scaled);
      this.obstacles.update(scaled, this.surfer.speed, this.wave, this.difficulty, this.score.distance);
      this.checkCollisions();
    } else {
      this.obstacles.update(scaled, this.surfer.speed, this.wave, this.difficulty, this.score.distance);
    }

    this.emitTrail(scaled);
    this.emitLipMist(scaled);
    this.particles.update(scaled, this.surfer.speed);
    this.popups.update(scaled, this.surfer.speed);
    this.updateCamera(dt);
    this.hud.update(dt, {
      score: this.score.total,
      multiplier: this.score.multiplier,
      inBarrel: this.wave.inBarrel,
      speedNorm: this.speedNorm,
    });

    this.audio.setIntensity(this.speedNorm, this.wave.inPocket(this.surfer.h), !wiping);

    if (wiping) {
      this.wipeoutTimer += dt;
      if (this.wipeoutTimer >= WIPEOUT_HOLD) { this.endRun(); }
    }
  }

  updateOver(dt, input) {
    this.time += dt;
    this.sinceOver += dt;
    this.timeScale = damp(this.timeScale, 1, 4, dt);
    this.particles.update(dt, this.surfer.speed);
    this.popups.update(dt, this.surfer.speed);
    this.updateCamera(dt);
    this.hud.update(dt, {
      score: this.score.total,
      multiplier: this.score.multiplier,
      inBarrel: this.wave.inBarrel,
      speedNorm: this.speedNorm,
    });

    // A short lockout so a mashed space bar doesn't skip the result.
    if (input.startPressed && this.sinceOver > 0.45) { this.start(); }
  }

  updateTimeScale(dt, wiping) {
    let target = 1;
    if (wiping) {
      target = 0.4;
    } else if (this.surfer.mode === MODE.air && Math.abs(this.surfer.spin) > Math.PI * 2.2 && this.surfer.vy > 0) {
      // Slow down the money moment: a big spin on its way back to the water.
      target = 0.6;
    }
    this.timeScale = damp(this.timeScale, target, 8, dt);
  }

  updateCamera(dt) {
    const target = Math.max(0, CAMERA.followLine - this.surfer.y);
    this.camY = damp(this.camY, target, CAMERA.ease, dt);
    this.shake = damp(this.shake, 0, CAMERA.shakeDecay, dt);
  }

  // --- Events --------------------------------------------------------------

  handleSurferEvent(event) {
    switch (event.type) {
      case 'launch':
        this.audio.launch(event.power);
        this.particles.burst(this.rng, this.surfer.x, this.surfer.y, 0.7 + event.power * 0.9);
        this.shake = Math.max(this.shake, 3 + event.power * 3);
        break;

      case 'pump':
        this.audio.pump();
        this.particles.wake(this.rng, this.surfer.x - 28, this.surfer.y + 10, this.surfer.speed, 5);
        break;

      case 'lipSpray':
        this.audio.lipSpray();
        this.particles.burst(this.rng, this.surfer.x + 10, this.surfer.y - 4, 0.35, { maxLife: 0.5 });
        break;

      case 'land':
        this.handleLanding(event);
        break;

      default:
        break;
    }
  }

  handleLanding(landing) {
    this.particles.burst(this.rng, this.surfer.x, this.surfer.y + 6, 0.9 + landing.power);
    this.audio.landing(landing.clean, landing.power);

    if (!landing.clean) {
      this.reason = landing.offAxis > 2.2
        ? 'You came down upside down.'
        : 'You landed sideways and caught a rail.';
      this.beginWipeout();
      return;
    }

    this.shake = Math.max(this.shake, 4 + landing.rotations * 2);

    const result = this.score.landTrick(landing);
    if (!result) { return; }

    this.audio.trick(Math.min(this.score.landedTricks, 8));
    this.popups.add(result.name, this.surfer.x, this.surfer.y - 90, {
      size: 30 + Math.min(landing.rotations, 3) * 6,
      color: landing.rotations >= 2 ? '#ffd465' : '#f6feff',
    });
    this.popups.add(`+${result.points}`, this.surfer.x, this.surfer.y - 58, {
      size: 22, color: '#8effc0', maxLife: 1.1,
    });

    if (this.score.checkHighScore()) {
      this.audio.highScore();
    }
  }

  checkCollisions() {
    const hit = this.obstacles.collide(this.surfer.bounds(), this.surfer.airborne);
    if (hit) {
      this.reason = hit.type.blame;
      this.particles.burst(this.rng, this.surfer.x + 10, this.surfer.y, 1.4);
      this.popups.add(hit.type.shout, hit.x, hit.y - 40, { size: 26, color: '#ffd465' });
      this.beginWipeout();
      return;
    }

    for (const near of this.obstacles.collectNearMisses(this.surfer)) {
      this.score.addNearMiss();
      this.audio.nearMiss();
      this.popups.add(near.type.shout, near.x, near.y - 34, {
        size: 20, color: 'rgba(255, 230, 170, 0.95)', maxLife: 1.1, rise: 30,
      });
    }
  }

  beginWipeout() {
    if (this.surfer.mode === MODE.wipeout) { return; }
    this.surfer.wipeout();
    this.audio.wipeout();
    this.shake = 16;
    this.wipeoutTimer = 0;
    this.popups.add('WIPEOUT!', this.surfer.x, this.surfer.y - 70, {
      size: 40, color: '#ff6b5e', maxLife: 1.6,
    });
  }

  endRun() {
    this.score.commit();
    this.state = STATE.over;
    this.sinceOver = 0;
    this.audio.setIntensity(0, false, false);
  }

  // --- Barrels -------------------------------------------------------------

  maybeStartBarrel() {
    if (this.wave.inBarrel || this.score.distance < this.wave.nextBarrelAt) { return; }
    if (this.surfer.mode !== MODE.riding) { return; }

    this.wave.startBarrel();
    this.wave.nextBarrelAt = this.score.distance + DIFFICULTY.barrelInterval
      + this.rng.range(-DIFFICULTY.barrelIntervalJitter, DIFFICULTY.barrelIntervalJitter);

    this.audio.barrelStart();
    // Below the banner the HUD puts at the top of the screen, not on top of it.
    this.popups.add('BARREL SECTION!', VIEW.width / 2, 232, {
      size: 34, color: '#ffd465', maxLife: 1.8, drift: 0, rise: 26,
    });
  }

  scoreBarrel(dt) {
    if (!this.wave.inBarrel || this.surfer.mode !== MODE.riding) { return; }
    if (this.surfer.h < BARREL.safeLow || this.surfer.h > BARREL.safeHigh) { return; }
    this.score.addBarrelTime(dt, this.wave.pocketDepth(this.surfer.h));
  }

  // --- Effects -------------------------------------------------------------

  emitTrail(dt) {
    const surfer = this.surfer;
    if (surfer.mode !== MODE.riding) { return; }

    this.particles.wake(this.rng, surfer.x - 26, surfer.y + 8, surfer.speed, 1);

    if (this.speedNorm > 0.62 && this.rng.chance(dt * 26)) {
      this.particles.speedLine(
        this.rng,
        surfer.x + this.rng.range(40, VIEW.width * 0.6),
        surfer.y + this.rng.range(-70, 90),
      );
    }
  }

  emitLipMist(dt) {
    if (this.rng.chance(dt * 22)) {
      const x = this.rng.range(0, VIEW.width);
      this.particles.mist(this.rng, x, this.wave.crestAt(x) - 4);
    }

    // Water raining off the curl during a barrel section.
    const intensity = this.wave.barrelIntensity();
    if (intensity > 0.2 && this.rng.chance(dt * 46 * intensity)) {
      const x = this.rng.range(0, VIEW.width);
      this.particles.spawn({
        x,
        y: this.wave.crestAt(x) + intensity * 58,
        vx: this.rng.range(-24, 8),
        vy: this.rng.range(20, 90),
        size: this.rng.range(1.2, 3.2),
        maxLife: this.rng.range(0.3, 0.6),
        gravity: 900,
        drift: 1,
      });
    }
  }

  // --- Render --------------------------------------------------------------

  render(ctx) {
    const shakeX = this.shake ? (this.rng.next() - 0.5) * this.shake : 0;
    const shakeY = this.shake ? (this.rng.next() - 0.5) * this.shake : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.scene.draw(ctx, { scroll: this.wave.scroll, camY: this.camY, time: this.time });

    ctx.save();
    ctx.translate(0, this.camY);

    this.waveRenderer.drawFace(ctx, this.wave, { time: this.time, camY: this.camY });

    for (const obstacle of this.obstacles.items) {
      drawObstacle(ctx, obstacle, this.wave, this.time);
    }

    drawSurfer(ctx, this.surfer, this.wave, this.time);
    this.particles.draw(ctx);

    // The lip is between the camera and the surfer, so it goes on top.
    this.waveRenderer.drawBarrel(ctx, this.wave, { time: this.time });

    drawRotationDial(ctx, this.surfer, SURFER.landingTolerance);
    this.popups.draw(ctx);

    ctx.restore();

    this.waveRenderer.drawBarrelVignette(ctx, this.wave.pocketDepth(this.surfer.h) * this.wave.barrelIntensity());
    this.drawVignette(ctx);

    const hudState = {
      score: this.score.total,
      highScore: this.score.highScore,
      multiplier: this.score.multiplier,
      wave: this.wave,
      surfer: this.surfer,
      muted: this.audio.muted,
      speedNorm: this.speedNorm,
      tutorial: this.tutorial,
      time: this.time,
      showTouch: this.showTouch,
      activeZones: this.activeZones,
      // The readouts step aside once a panel takes over the screen.
      hudFade: this.state === STATE.title ? 0
        : this.state === STATE.over ? 1 - clamp(this.sinceOver / 0.3, 0, 1)
          : this.state === STATE.paused ? 0.3 : 1,
    };

    // Always drawn: at fade 0 this is just the sound control.
    this.hud.draw(ctx, hudState);

    // The title card fades out over the first moments of a run rather than
    // cutting, so paddling out feels like one movement.
    const titleFade = this.state === STATE.title
      ? 1
      : this.fadingTitle * (1 - clamp(this.sinceStart / 0.3, 0, 1));

    if (titleFade > 0.01) {
      this.hud.drawTitle(ctx, {
        elapsed: this.titlePhase,
        highScore: this.score.highScore,
        bestTrick: this.score.bestTrick,
        showTouch: this.showTouch,
        fade: titleFade,
      });
    }

    if (this.state === STATE.paused) {
      this.hud.drawPaused(ctx, { showTouch: this.showTouch });
    }

    if (this.state === STATE.over) {
      this.hud.drawGameOver(ctx, {
        elapsed: this.sinceOver,
        score: this.score.total,
        highScore: this.score.highScore,
        reason: this.reason,
        breakdown: this.score.breakdown(),
        beatHighScore: this.score.beatHighScore,
        showTouch: this.showTouch,
      });
    }

    // A wash of foam over the lens as you drop in.
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(226, 252, 255, ${this.flash * 0.42})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    ctx.restore();
  }

  drawVignette(ctx) {
    const gradient = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 1.05,
    );
    gradient.addColorStop(0, 'rgba(3, 26, 38, 0)');
    gradient.addColorStop(1, 'rgba(3, 26, 38, 0.42)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}
