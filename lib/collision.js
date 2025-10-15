function Collision(surfer) {
  this.surfer = surfer;
}

Collision.prototype.checkForCollision = function(obstacles) {
  return obstacles.find(function(obstacle) {
    return this.isCollision(obstacle);
  }, this);
};

Collision.prototype.horizontalColliding = function (obstacle) {
  return obstacle.x < this.surfer.right && obstacle.right > this.surfer.x;
};

Collision.prototype.verticalColliding = function (obstacle) {
  return obstacle.y < this.surfer.bottom && obstacle.bottom > this.surfer.y;
};

Collision.prototype.isCollision = function(obstacle) {
  return this.horizontalColliding(obstacle) && this.verticalColliding(obstacle);
};

module.exports = Collision;
