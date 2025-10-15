const Obstacle = require('./rocks');
const World = require('./world');
const Surfer = require('./surfer');
const Collision = require('./collision');
const FONTS = require('./constants/fonts');
const canvas = document.getElementById('surfer-game');


function Game() {
  this.canvas = canvas;
  this.context = this.canvas.getContext('2d');
  this.surfer = new Surfer({});
  this.obstacles = this.createObstacles();
  this.world = new World(this.canvas.width, this.canvas.height, this.surfer, this.obstacles);
  this.collision = new Collision(this.surfer);
  this.tick = 0;
  this.score = 0;
  this.active = true;
}

Game.prototype.cycle = function () {
  this.renderWorld(this.context, this.world);
  this.animateSurfer();
  if (this.collision.checkForCollision(this.obstacles)) {
    this.gameOver();
  }
  this.obstacles.forEach(function(obstacle) {
    obstacle.moveLeft();
  });
  this.world.surfer.update();
  this.tick++;
  if (this.tick % 5 === 0) {
    this.score++;
  }
  this.speedUpObstacles();
};

Game.prototype.renderWorld = function () {
  this.context.clearRect(0, 0, this.world.width, this.world.height);
  this.obstacles.forEach(function(obstacle) {
    if (obstacle.type === 'swimmer') {
      this.context.drawImage(obstacle.image, 0, 0, 35, 35, obstacle.x, obstacle.y, 35, 35);
    }
    if (obstacle.type === 'surfer') {
      this.context.drawImage(obstacle.image, 0, 0, 40, 50, obstacle.x, obstacle.y, 40, 50);
    }
    if (obstacle.type === 'person') {
      this.context.drawImage(obstacle.image, 0, 0, 45, 55, obstacle.x, obstacle.y, 45, 55);
    }
  }.bind(this));
  this.context.font= FONTS.main;
  this.context.fillText('Score: ' + this.score, 425, 40);
};

Game.prototype.createObstacles = function () {
  return [
    new Obstacle({ game: this }).surfer(),
    new Obstacle({ game: this }).swimmer(),
    new Obstacle({ game: this }).person(),
    new Obstacle({ game: this }).surfer(),
    new Obstacle({ game: this }).swimmer()
  ];
};

Game.prototype.speedUpObstacles = function () {
  if (this.score % 101 === 0) {
    return this.obstacles.forEach(function(obstacle) {
      return obstacle.speed += 0.05;
    });
  }
};

Game.prototype.gameOver = function () {
  this.context.font = FONTS.large;
  this.context.fillText('Game Over', 160, 105);
  this.active = false;
};

// ANIMATING THE SURFER

Game.prototype.animateSurfer = function () {
  if (this.firstThird()) {
    this.context.drawImage(this.world.surfer.image, 0, 0, 50, 60, this.world.surfer.x, this.world.surfer.y, 50, 60);
  } else if (this.secondThird()) {
    this.context.drawImage(this.world.surfer.image, 50, 0, 50, 60, this.world.surfer.x, this.world.surfer.y, 50, 60);
  } else {
    this.context.drawImage(this.world.surfer.image, 100, 0, 50, 60, this.world.surfer.x, this.world.surfer.y, 50, 60);
  }
  this.resetTick();
};

Game.prototype.resetTick = function() {
  if (this.tick >= 60) {this.tick = 0;}
};

Game.prototype.firstThird = function () {
  return this.tick > 0 && this.tick < 20;
};

Game.prototype.secondThird = function () {
  return this.tick > 20 && this.tick < 40;
};

module.exports = Game;
