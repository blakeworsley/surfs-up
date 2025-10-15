const canvas = document.getElementById('surfer-game');
const Game = require('./game');
const KEYS = require('./constants/keys');

var game = new Game(canvas);

document.addEventListener('keydown', function (e) {
  if (e.keyCode === KEYS.spacebar && !game.active) {
    game = new Game(canvas);
  }
  if (game.active) {
    if (e.keyCode === KEYS.up || e.keyCode === KEYS.w) {
      game.world.surfer.moveUp();
    }
    if (e.keyCode === KEYS.down || e.keyCode === KEYS.s) {
      game.world.surfer.moveDown();
    }
  }
});

document.addEventListener('keyup', function (e) {
  if (game.active) {
    if (e.keyCode === KEYS.up || e.keyCode === KEYS.w) {
      game.world.surfer.stopMovingUp();
    }
    if (e.keyCode === KEYS.down || e.keyCode === KEYS.s) {
      game.world.surfer.stopMovingDown();
    }
  }
});

requestAnimationFrame(function gameLoop() {
  if (game.active) {
    game.cycle();
  }
  requestAnimationFrame(gameLoop);
});

module.exports = canvas;
