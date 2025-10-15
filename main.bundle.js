/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	const canvas = document.getElementById('surfer-game');
	const Game = __webpack_require__(1);
	const KEYS = __webpack_require__(7);

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

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

	const Obstacle = __webpack_require__(2);
	const World = __webpack_require__(3);
	const Surfer = __webpack_require__(4);
	const Collision = __webpack_require__(5);
	const FONTS = __webpack_require__(6);
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
	  this.obstacles.forEach(function (obstacle) {
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
	  this.obstacles.forEach(function (obstacle) {
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
	  this.context.font = FONTS.main;
	  this.context.fillText('Score: ' + this.score, 425, 40);
	};

	Game.prototype.createObstacles = function () {
	  return [new Obstacle({ game: this }).surfer(), new Obstacle({ game: this }).swimmer(), new Obstacle({ game: this }).person(), new Obstacle({ game: this }).surfer(), new Obstacle({ game: this }).swimmer()];
	};

	Game.prototype.speedUpObstacles = function () {
	  if (this.score % 101 === 0) {
	    return this.obstacles.forEach(function (obstacle) {
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

	Game.prototype.resetTick = function () {
	  if (this.tick >= 60) {
	    this.tick = 0;
	  }
	};

	Game.prototype.firstThird = function () {
	  return this.tick > 0 && this.tick < 20;
	};

	Game.prototype.secondThird = function () {
	  return this.tick > 20 && this.tick < 40;
	};

	module.exports = Game;

/***/ }),
/* 2 */
/***/ (function(module, exports) {

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

	Obstacle.prototype.isOffScreenLeft = function () {
	  return this.x < 0 - this.width;
	};

	Obstacle.prototype.moveLeft = function () {
	  if (this.isOffScreenLeft()) {
	    this.placeObstacle();
	    this.y = this.randomY(); // Randomize vertical position when respawning
	    return;
	  }
	  this.x = this.x - this.speed;
	  this.right = this.x + this.width;
	  return this;
	};

	Obstacle.prototype.surfer = function () {
	  this.width = 40;
	  this.height = 50;
	  this.image = new Image();
	  this.image.src = `./img/medium-rock.png`; // Will use rock as placeholder
	  this.type = 'surfer';
	  return this;
	};

	Obstacle.prototype.swimmer = function () {
	  this.width = 35;
	  this.height = 35;
	  this.image = new Image();
	  this.image.src = `./img/small-rock.png`; // Will use rock as placeholder
	  this.type = 'swimmer';
	  return this;
	};

	Obstacle.prototype.person = function () {
	  this.width = 45;
	  this.height = 55;
	  this.image = new Image();
	  this.image.src = `./img/large-rock.png`; // Will use rock as placeholder
	  this.type = 'person';
	  return this;
	};

	Obstacle.prototype.randomXGenerator = function () {
	  return Math.floor(Math.random() * (3000 - 800)) + 800;
	};

	Obstacle.prototype.randomY = function () {
	  // Generate random Y position between 20 and 140 (within playable area)
	  return Math.floor(Math.random() * (140 - 20)) + 20;
	};

	Obstacle.prototype.placeObstacle = function () {
	  this.x = this.randomXGenerator();
	  return this.x;
	};

	module.exports = Obstacle;

/***/ }),
/* 3 */
/***/ (function(module, exports) {

	function World(width, height, surfer, obstacles) {
	  this.width = width || 600;
	  this.height = height || 200;
	  this.surfer = surfer;
	  this.obstacles = obstacles;
	}

	module.exports = World;

/***/ }),
/* 4 */
/***/ (function(module, exports) {

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

/***/ }),
/* 5 */
/***/ (function(module, exports) {

	function Collision(surfer) {
	  this.surfer = surfer;
	}

	Collision.prototype.checkForCollision = function (obstacles) {
	  return obstacles.find(function (obstacle) {
	    return this.isCollision(obstacle);
	  }, this);
	};

	Collision.prototype.horizontalColliding = function (obstacle) {
	  return obstacle.x < this.surfer.right && obstacle.right > this.surfer.x;
	};

	Collision.prototype.verticalColliding = function (obstacle) {
	  return obstacle.y < this.surfer.bottom && obstacle.bottom > this.surfer.y;
	};

	Collision.prototype.isCollision = function (obstacle) {
	  return this.horizontalColliding(obstacle) && this.verticalColliding(obstacle);
	};

	module.exports = Collision;

/***/ }),
/* 6 */
/***/ (function(module, exports) {

	const FONTS = {
	  main: '40px Covered By Your Grace',
	  large: '70px Covered By Your Grace'
	};

	module.exports = FONTS;

/***/ }),
/* 7 */
/***/ (function(module, exports) {

	const KEYS = {
	  spacebar: 32,
	  up: 38,
	  down: 40,
	  w: 87,
	  s: 83
	};

	module.exports = KEYS;

/***/ })
/******/ ]);