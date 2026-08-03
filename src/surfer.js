import { SURFER, BARREL } from './config.js';
import { TAU, clamp, damp, lerp, ratio, offAxis, completedRotations } from './util/math.js';

export const MODE = {
  riding: 'riding',
  air: 'air',
  wipeout: 'wipeout',
};

/**
 * The surfer's physics.
 *
 * Two very different worlds live in here:
 *
 *  - On the face, position is a normalised height `h` (0 trough, 1 lip) with
 *    velocity in h-units. Gravity constantly tugs you back down the face, so
 *    holding a high line takes effort, and dropping low buys you speed.
 *
 *  - In the air, position is honest screen pixels with real gravity, plus a
 *    rotation you have to bring back around to upright before you touch down.
 *
 * `update` returns a list of events for the game to turn into score, sound and
 * particles. Keeping them as data (rather than callbacks) is what lets the
 * whole thing run headless in tests.
 */
export class Surfer {
  constructor() {
    this.reset();
  }

  reset() {
    this.mode = MODE.riding;
    this.x = SURFER.homeX;
    this.h = 0.55;
    this.vh = 0;
    this.y = 0;
    this.speed = SURFER.baseSpeed;
    this.vy = 0;
    this.vxAir = 0;
    this.spin = 0;
    this.spinRate = 0;
    this.airTime = 0;
    this.grabTime = 0;
    this.grabbing = false;
    this.launchPower = 0;
    this.pumpTimer = 0;
    this.landingSquash = 0;
    this.tumble = 0;
    this.wipeoutTime = 0;
    this.lipTouch = 0; // seconds spent riding hard against the lip
  }

  get airborne() {
    return this.mode === MODE.air;
  }

  /** Collision box in screen space. Smaller than the drawing, on purpose. */
  bounds() {
    return {
      x: this.x - SURFER.hitWidth / 2,
      y: this.y - SURFER.hitHeight / 2,
      width: SURFER.hitWidth,
      height: SURFER.hitHeight,
    };
  }

  /**
   * @param {number} dt seconds
   * @param {{up:boolean,down:boolean,left:boolean,right:boolean,action:boolean,actionPressed:boolean}} input
   * @param {import('./wave.js').Wave} wave
   * @param {number} difficulty 0..1
   */
  update(dt, input, wave, difficulty) {
    const events = [];
    this.pumpTimer = Math.max(0, this.pumpTimer - dt);
    this.landingSquash = Math.max(0, this.landingSquash - dt * 4);

    if (this.mode === MODE.riding) {
      this.updateRiding(dt, input, wave, difficulty, events);
    } else if (this.mode === MODE.air) {
      this.updateAir(dt, input, wave, events);
    } else {
      this.updateWipeout(dt, wave);
    }

    return events;
  }

  // --- Riding the face -----------------------------------------------------

  updateRiding(dt, input, wave, difficulty, events) {
    // Act on the button before integrating physics, so a launch uses the
    // height the player could actually see when they pressed it.
    if (input.actionPressed) {
      if (this.canLaunch(wave)) {
        this.launch(wave, events);
        return;
      }
      if (this.pumpTimer === 0) {
        this.pumpTimer = SURFER.pumpCooldown;
        this.speed += SURFER.pumpBoost;
        events.push({ type: 'pump' });
      }
    }

    let accel = -SURFER.faceGravity;
    if (input.up) { accel += SURFER.climbAccel; }
    if (input.down) { accel -= SURFER.dropAccel; }

    // Inside a barrel the falling lip shoves you out of the top of the tube,
    // so climbing too high stops being an option.
    if (wave.inBarrel && this.h > BARREL.safeHigh) {
      accel -= BARREL.lipPush * wave.barrelIntensity();
    }

    this.vh += accel * dt;
    this.vh = damp(this.vh, 0, SURFER.faceDrag, dt);
    this.h += this.vh * dt;

    if (this.h >= SURFER.maxH) {
      this.h = SURFER.maxH;
      this.vh = Math.min(this.vh, 0);
      this.lipTouch += dt;
      if (this.lipTouch > 0.12) {
        this.lipTouch = 0;
        events.push({ type: 'lipSpray' });
      }
    } else if (this.h <= SURFER.minH) {
      this.h = SURFER.minH;
      this.vh = Math.max(this.vh, 0);
    } else {
      this.lipTouch = 0;
    }

    this.applySpeed(dt, input, difficulty);
    this.x = damp(this.x, SURFER.homeX, SURFER.airDriftReturn, dt);
    this.y = wave.yAt(this.x, this.h);
    this.spin = damp(this.spin, 0, 12, dt);
  }

  applySpeed(dt, input, difficulty) {
    const base = SURFER.baseSpeed + SURFER.speedFromDifficulty * difficulty;
    const fromHeight = lerp(SURFER.speedAtTrough, SURFER.speedAtLip, this.h);
    let trim = 1;
    if (input.right) { trim = 1.1; }
    if (input.left) { trim = 0.9; }
    this.speed = damp(this.speed, base * fromHeight * trim, SURFER.speedResponse, dt);
  }

  canLaunch(wave) {
    return this.h >= SURFER.launchMinH && !wave.inBarrel;
  }

  launch(wave, events) {
    const speedNorm = ratio(this.speed, SURFER.baseSpeed, SURFER.baseSpeed + SURFER.speedFromDifficulty * 1.2);
    const pop = SURFER.popBase + SURFER.popFromH * this.h + SURFER.popFromSpeed * speedNorm;

    this.mode = MODE.air;
    this.y = wave.crestAt(this.x);
    this.vy = -pop;
    this.vxAir = SURFER.airForwardBase + SURFER.airForwardFromPop * ratio(pop, SURFER.popBase, SURFER.popBase + SURFER.popFromH + SURFER.popFromSpeed);
    this.launchPower = ratio(pop, SURFER.popBase, SURFER.popBase + SURFER.popFromH + SURFER.popFromSpeed);
    this.spin = 0;
    this.spinRate = 0;
    this.airTime = 0;
    this.grabTime = 0;
    this.grabbing = false;
    this.vh = 0;

    events.push({ type: 'launch', power: this.launchPower });
  }

  // --- In the air ----------------------------------------------------------

  updateAir(dt, input, wave, events) {
    this.airTime += dt;
    this.grabbing = input.action;
    if (this.grabbing) { this.grabTime += dt; }

    const spinScale = this.grabbing ? SURFER.grabSpinScale : 1;
    const spinning = input.left || input.right;
    if (input.left) { this.spinRate -= SURFER.spinAccel * spinScale * dt; }
    if (input.right) { this.spinRate += SURFER.spinAccel * spinScale * dt; }
    if (!spinning) {
      this.spinRate = damp(this.spinRate, 0, SURFER.spinDamping, dt);
    }
    this.spinRate = clamp(this.spinRate, -SURFER.spinMax, SURFER.spinMax);
    this.spin += this.spinRate * dt;

    if (!spinning) {
      // Ease toward whichever whole rotation is closest, so releasing the key
      // reads as "stomping it" rather than hoping the timing worked out.
      const upright = Math.round(this.spin / TAU) * TAU;
      this.spin = damp(this.spin, upright, SURFER.spinSettle, dt);
    }

    this.vy += SURFER.gravity * dt;
    if (input.down) { this.vy += SURFER.diveAccel * dt; }
    this.y += this.vy * dt;
    this.x = Math.min(this.x + this.vxAir * dt, SURFER.homeX + 190);

    const crest = wave.crestAt(this.x);
    if (this.vy > 0 && this.y >= crest) {
      this.touchDown(wave, crest, events);
    }
  }

  touchDown(wave, crest, events) {
    const miss = offAxis(this.spin);
    const clean = miss <= SURFER.landingTolerance;
    const rotations = completedRotations(this.spin);

    const landing = {
      type: 'land',
      clean,
      rotations,
      airTime: this.airTime,
      grabTime: this.grabTime,
      offAxis: miss,
      power: this.launchPower,
    };

    this.y = crest;
    this.h = SURFER.landingH;
    this.vh = SURFER.landingDropIn;
    this.vy = 0;
    this.airTime = 0;
    this.grabbing = false;
    this.landingSquash = 1;

    if (clean) {
      this.mode = MODE.riding;
      this.spin = 0;
      this.spinRate = 0;
      this.speed *= SURFER.cleanLandingBoost;
    } else {
      this.wipeout();
    }

    events.push(landing);
  }

  // --- Eating it -----------------------------------------------------------

  wipeout() {
    if (this.mode === MODE.wipeout) { return; }
    this.mode = MODE.wipeout;
    this.wipeoutTime = 0;
    this.tumble = this.spinRate !== 0 ? Math.sign(this.spinRate) * 6 : 5.5;
    this.vy = -180;
  }

  updateWipeout(dt, wave) {
    this.wipeoutTime += dt;
    this.speed = damp(this.speed, 0, 2.6, dt);
    this.spin += this.tumble * dt;
    this.tumble = damp(this.tumble, 0, 1.2, dt);
    this.vy += SURFER.gravity * 0.45 * dt;
    this.y += this.vy * dt;
    const floor = wave.yAt(this.x, 0.12);
    if (this.y > floor) {
      this.y = floor;
      this.vy *= -0.35;
    }
    this.x = damp(this.x, SURFER.homeX - 60, 1.4, dt);
  }
}
