function Surfer(options) {
  this.x = options.x || 20;
  this.y = options.y || 100; // Middle of canvas
  this.width = 50;
  this.height = 60;
  this.right = this.x + this.width;
  this.verticalSpeed = 4; // Speed for moving up/down
  this.movingUp = false;
  this.movingDown = false;
  this.minY = 20; // Top boundary
  this.maxY = 140; // Bottom boundary (200 - 60)
  this.bottom = this.y + this.height;
  this.image = new Image();
  this.image.src = `./img/surfer.png`;
}

Surfer.prototype.moveUp = function () {
  this.movingUp = true;
};

Surfer.prototype.moveDown = function () {
  this.movingDown = true;
};

Surfer.prototype.stopMovingUp = function () {
  this.movingUp = false;
};

Surfer.prototype.stopMovingDown = function () {
  this.movingDown = false;
};

Surfer.prototype.update = function () {
  if (this.movingUp && this.y > this.minY) {
    this.y -= this.verticalSpeed;
  }
  if (this.movingDown && this.y < this.maxY) {
    this.y += this.verticalSpeed;
  }
  this.bottom = this.y + this.height;
};

module.exports = Surfer;
