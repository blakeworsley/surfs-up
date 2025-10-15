function Obstacle(options) {
  this.width = options.width || 40;
  this.height = options.height || 50;
  this.x = this.placeObstacle();
  this.y = options.y || this.randomY();
  this.bottom = this.y + this.height;
  this.right = this.x + this.width;
  this.speed = 5;
  this.type = options.type || 'surfer';
}

Obstacle.prototype.isOffScreenLeft = function() {
  return this.x < 0 - this.width;
};

Obstacle.prototype.moveLeft = function() {
  if (this.isOffScreenLeft()) {
    this.placeObstacle();
    this.y = this.randomY(); // Randomize vertical position when respawning
    return;
  }
  this.x = this.x - this.speed;
  this.right = this.x + this.width;
  return this;
};

Obstacle.prototype.surfer = function() {
  this.width = 40;
  this.height = 50;
  this.image = new Image();
  this.image.src = `./img/medium-rock.png`; // Will use rock as placeholder
  this.type = 'surfer';
  return this;
};

Obstacle.prototype.swimmer = function() {
  this.width = 35;
  this.height = 35;
  this.image = new Image();
  this.image.src = `./img/small-rock.png`; // Will use rock as placeholder
  this.type = 'swimmer';
  return this;
};

Obstacle.prototype.person = function() {
  this.width = 45;
  this.height = 55;
  this.image = new Image();
  this.image.src = `./img/large-rock.png`; // Will use rock as placeholder
  this.type = 'person';
  return this;
};

Obstacle.prototype.randomXGenerator = function() {
  return Math.floor(Math.random() * (3000 - 800)) + 800;
};

Obstacle.prototype.randomY = function() {
  // Generate random Y position between 20 and 140 (within playable area)
  return Math.floor(Math.random() * (140 - 20)) + 20;
};

Obstacle.prototype.placeObstacle = function() {
  this.x = this.randomXGenerator();
  return this.x;
};

module.exports = Obstacle;
