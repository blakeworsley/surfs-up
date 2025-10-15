function World(width, height, surfer, obstacles) {
  this.width = width || 600;
  this.height = height || 200;
  this.surfer = surfer;
  this.obstacles = obstacles;
}

module.exports = World;
