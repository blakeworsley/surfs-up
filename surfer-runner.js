(function () {
  'use strict';

  const canvas = document.getElementById('surfer-game');
  const context = canvas.getContext('2d');

  // Simple WebAudio beeps for feedback without assets
  let audioCtx = null;
  function ensureAudioContext() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function beep(frequency, durationMs, type, volume) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type || 'sine';
    oscillator.frequency.value = frequency || 440;
    gain.gain.value = volume == null ? 0.05 : volume;
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + (durationMs || 120) / 1000);
  }

  const KEYS = {
    up: 38,
    down: 40,
    space: 32,
    w: 87,
    s: 83
  };

  const GAME_CONFIG = {
    gravity: 0.6,
    upThrust: 0.9,
    maxAscendSpeed: 8,
    maxDescendSpeed: 10,
    baseSpeed: 6,
    speedIncreaseEveryScore: 120, // ticks worth of score increments
    speedIncreaseAmount: 0.05,
    minSpawnGap: 220,
    maxSpawnGap: 420
  };

  function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  class InputState {
    constructor() {
      this.up = false;
      this.down = false;
    }
  }

  class Surfer {
    constructor(floorY) {
      this.floorY = floorY;
      this.x = 40;
      this.y = floorY - 60;
      this.width = 50;
      this.height = 60;
      this.velocityY = 0;
      this.image = new Image();
      this.image.src = './img/surfer.png';
      this.spriteFrame = 0;
      this.spriteTick = 0;
      this.isDucking = false;
    }

    update(input) {
      this.isDucking = !!input.down;

      if (input.up) {
        this.velocityY -= GAME_CONFIG.upThrust;
      }

      this.velocityY += GAME_CONFIG.gravity * (this.isDucking ? 1.25 : 1);
      this.velocityY = clamp(
        this.velocityY,
        -GAME_CONFIG.maxAscendSpeed,
        GAME_CONFIG.maxDescendSpeed
      );

      this.y += this.velocityY;

      const maxY = this.floorY - this.height;
      if (this.y > maxY) {
        this.y = maxY;
        this.velocityY = 0;
      }
      if (this.y < 0) {
        this.y = 0;
        this.velocityY = 0;
      }

      // Animate sprite (3 frames horizontally in surfer.png)
      this.spriteTick = (this.spriteTick + 1) % 60;
      if (this.spriteTick % 10 === 0) {
        this.spriteFrame = (this.spriteFrame + 1) % 3;
      }
    }

    draw(ctx) {
      const frameWidth = 50;
      const frameHeight = 60;
      const sx = this.spriteFrame * frameWidth;
      const sy = 0;

      if (this.isDucking) {
        // Visually shrink height while ducking
        const duckHeight = 40;
        const dy = this.y + (this.height - duckHeight);
        ctx.drawImage(this.image, sx, sy, frameWidth, frameHeight, this.x, dy, frameWidth, duckHeight);
      } else {
        ctx.drawImage(this.image, sx, sy, frameWidth, frameHeight, this.x, this.y, frameWidth, frameHeight);
      }
    }

    getCollisionBox() {
      return {
        x: this.x + 6,
        y: this.isDucking ? this.y + (this.height - 40) : this.y,
        width: this.width - 12,
        height: this.isDucking ? 40 : this.height
      };
    }
  }

  class Obstacle {
    constructor(x, y, width, height, speed) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.speed = speed;
      this.right = this.x + this.width;
      this.bottom = this.y + this.height;
      this.bobAmplitude = 0;
      this.bobFrequency = 0;
      this.bobPhase = Math.random() * Math.PI * 2;
      this.type = 'obstacle';
    }

    setBobbing(amplitude, frequency) {
      this.bobAmplitude = amplitude;
      this.bobFrequency = frequency;
      return this;
    }

    update(tick) {
      this.x -= this.speed;
      if (this.bobAmplitude > 0 && this.bobFrequency > 0) {
        const dy = Math.sin(this.bobPhase + tick * this.bobFrequency) * this.bobAmplitude;
        this.y += dy;
        // counter-adjust to keep baseline
        this.y -= dy; // neutralize to avoid drift between frames
      }
      this.right = this.x + this.width;
      this.bottom = this.y + this.height;
    }

    draw(ctx) {
      ctx.fillStyle = '#0A6C74';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    getCollisionBox() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    isOffScreenLeft() {
      return this.x + this.width < 0;
    }
  }

  class Swimmer extends Obstacle {
    constructor(x, baseY, speed) {
      const width = 24;
      const height = 18;
      super(x, baseY - height, width, height, speed);
      this.type = 'swimmer';
      this.bobAmplitude = 2 + Math.random() * 3;
      this.bobFrequency = 0.08 + Math.random() * 0.06;
    }

    update(tick) {
      this.x -= this.speed;
      const dy = Math.sin(this.bobPhase + tick * this.bobFrequency) * this.bobAmplitude;
      this.y += dy;
      this.right = this.x + this.width;
      this.bottom = this.y + this.height;
    }

    draw(ctx) {
      ctx.fillStyle = '#EE6352';
      ctx.beginPath();
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      ctx.arc(cx, cy, this.width / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class RivalSurfer extends Obstacle {
    constructor(x, midY, speed) {
      const width = 40;
      const height = 28;
      super(x, midY - height / 2, width, height, speed);
      this.type = 'rival';
      this.bobAmplitude = 6 + Math.random() * 6;
      this.bobFrequency = 0.05 + Math.random() * 0.04;
    }

    update(tick) {
      this.x -= this.speed * 1.05;
      const dy = Math.sin(this.bobPhase + tick * this.bobFrequency) * this.bobAmplitude;
      this.y += dy;
      this.right = this.x + this.width;
      this.bottom = this.y + this.height;
    }

    draw(ctx) {
      ctx.fillStyle = '#08B2E3';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = '#064273';
      ctx.fillRect(this.x + 6, this.y + 4, this.width - 12, this.height - 8);
    }
  }

  class Spawner {
    constructor(canvasWidth, floorY, baseSpeed) {
      this.canvasWidth = canvasWidth;
      this.floorY = floorY;
      this.baseSpeed = baseSpeed;
      this.nextGap = this.randomGap();
    }

    randomGap() {
      const { minSpawnGap, maxSpawnGap } = GAME_CONFIG;
      return Math.floor(Math.random() * (maxSpawnGap - minSpawnGap)) + minSpawnGap;
    }

    maybeSpawn(obstacles) {
      if (obstacles.length === 0) {
        obstacles.push(this.makeRandomObstacle());
        this.nextGap = this.randomGap();
        return;
      }
      const last = obstacles[obstacles.length - 1];
      const distanceFromRightEdge = this.canvasWidth - (last.x + last.width);
      if (distanceFromRightEdge > this.nextGap) {
        obstacles.push(this.makeRandomObstacle());
        this.nextGap = this.randomGap();
      }
    }

    makeRandomObstacle() {
      const speed = this.baseSpeed;
      const roll = Math.random();
      if (roll < 0.55) {
        // swimmer near surface
        const surfaceMin = this.floorY - 50;
        const surfaceMax = this.floorY - 24;
        const y = Math.floor(Math.random() * (surfaceMax - surfaceMin)) + surfaceMin;
        return new Swimmer(this.canvasWidth + 20, y, speed);
      }
      // rival surfer mid water
      const midMin = this.floorY - 120;
      const midMax = this.floorY - 70;
      const y = Math.floor(Math.random() * (midMax - midMin)) + midMin;
      return new RivalSurfer(this.canvasWidth + 20, y, speed);
    }
  }

  class Game {
    constructor(canvas, ctx) {
      this.canvas = canvas;
      this.ctx = ctx;
      this.floorY = this.canvas.height - 10;
      this.active = true;
      this.tick = 0;
      this.score = 0;
      this.worldSpeed = GAME_CONFIG.baseSpeed;
      this.input = new InputState();
      this.surfer = new Surfer(this.floorY);
      this.obstacles = [];
      this.spawner = new Spawner(this.canvas.width, this.floorY, this.worldSpeed);
      this.hudFont = '40px Covered By Your Grace';
      this.bigFont = '70px Covered By Your Grace';
      this.bindEvents();
    }

    bindEvents() {
      window.addEventListener('keydown', (e) => {
        if (e.keyCode === KEYS.up || e.keyCode === KEYS.w) this.input.up = true;
        if (e.keyCode === KEYS.down || e.keyCode === KEYS.s) this.input.down = true;
        if (!this.active && e.keyCode === KEYS.space) this.reset();
      });

      window.addEventListener('keyup', (e) => {
        if (e.keyCode === KEYS.up || e.keyCode === KEYS.w) this.input.up = false;
        if (e.keyCode === KEYS.down || e.keyCode === KEYS.s) this.input.down = false;
      });
    }

    reset() {
      this.active = true;
      this.tick = 0;
      this.score = 0;
      this.worldSpeed = GAME_CONFIG.baseSpeed;
      this.input = new InputState();
      this.surfer = new Surfer(this.floorY);
      this.obstacles = [];
      this.spawner = new Spawner(this.canvas.width, this.floorY, this.worldSpeed);
    }

    update() {
      this.clear();

      if (!this.active) {
        this.drawGameOver();
        return;
      }

      // Spawn logic
      this.spawner.baseSpeed = this.worldSpeed;
      this.spawner.maybeSpawn(this.obstacles);

      // Update and draw obstacles
      const newObstacles = [];
      for (let i = 0; i < this.obstacles.length; i++) {
        const obstacle = this.obstacles[i];
        obstacle.speed = this.worldSpeed;
        obstacle.update(this.tick);
        if (!obstacle.isOffScreenLeft()) {
          newObstacles.push(obstacle);
        }
      }
      this.obstacles = newObstacles;

      // Draw background subtle waterline
      this.drawWaterline();

      // Draw obstacles after background
      for (let i = 0; i < this.obstacles.length; i++) {
        this.obstacles[i].draw(this.ctx);
      }

      // Update and draw player
      this.surfer.update(this.input);
      this.surfer.draw(this.ctx);

      // Collisions
      const surferBox = this.surfer.getCollisionBox();
      for (let i = 0; i < this.obstacles.length; i++) {
        if (rectsOverlap(surferBox, this.obstacles[i].getCollisionBox())) {
          this.gameOver();
          break;
        }
      }

      // Score and difficulty
      this.tick++;
      if (this.tick % 5 === 0) this.score++;
      if (this.score > 0 && this.score % GAME_CONFIG.speedIncreaseEveryScore === 0) {
        this.worldSpeed += GAME_CONFIG.speedIncreaseAmount;
      }

      this.drawHUD();
    }

    clear() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawWaterline() {
      this.ctx.strokeStyle = 'rgba(10, 108, 116, 0.35)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      const y = this.floorY + 2;
      this.ctx.moveTo(0, y);
      for (let x = 0; x <= this.canvas.width; x += 12) {
        const offset = Math.sin((x + this.tick * 3) * 0.03) * 1.5;
        this.ctx.lineTo(x, y - offset);
      }
      this.ctx.stroke();
    }

    drawHUD() {
      this.ctx.font = this.hudFont;
      this.ctx.fillStyle = '#000000';
      this.ctx.fillText('Score: ' + this.score, this.canvas.width - 180, 40);
    }

    gameOver() {
      this.active = false;
      beep(180, 180, 'square', 0.08);
      setTimeout(() => beep(140, 220, 'square', 0.08), 100);
      this.drawGameOver();
    }

    drawGameOver() {
      this.ctx.font = this.bigFont;
      this.ctx.fillStyle = '#000000';
      this.ctx.fillText('Game Over', 160, 105);
      this.ctx.font = this.hudFont;
      this.ctx.fillText('Press Space to restart', 160, 140);
    }
  }

  const game = new Game(canvas, context);

  function loop() {
    game.update();
    window.requestAnimationFrame(loop);
  }

  window.requestAnimationFrame(loop);
})();