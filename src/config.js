/**
 * Every number that shapes how the game feels lives here.
 *
 * Positions are in "logical" canvas pixels: the canvas always presents a
 * VIEW.width x VIEW.height coordinate space no matter how big it is on screen.
 *
 * Height on the wave face is expressed as `h`, a normalised 0..1 value where
 * 0 is the trough (bottom of the face) and 1 is the lip (the crest). Keeping
 * everything in `h` means the wave can wobble and swell without any of the
 * gameplay code needing to care.
 */

export const VIEW = {
  width: 960,
  height: 540,
};

export const WAVE = {
  // Crest (lip) line: a base height plus two sine terms so it never repeats
  // in an obvious way.
  crestBase: 196,
  crestWaves: [
    { amplitude: 26, frequency: 0.0042, phase: 0 },
    { amplitude: 11, frequency: 0.0113, phase: 1.7 },
  ],
  // Trough line: where the face flattens out into the shoulder.
  troughBase: 458,
  troughWaves: [
    { amplitude: 14, frequency: 0.0031, phase: 2.4 },
    { amplitude: 6, frequency: 0.0089, phase: 0.6 },
  ],
  // How far the wave texture scrolls relative to the world. 1 = locked to the
  // surfer's forward speed.
  scrollRate: 1,
};

export const SURFER = {
  homeX: 250,
  // Bounding box used for collisions. Deliberately smaller than the drawing:
  // near misses should feel near, not fatal.
  hitWidth: 46,
  hitHeight: 40,

  // --- Riding the face ---
  climbAccel: 2.6, // h units / second^2
  dropAccel: 3.0,
  faceGravity: 0.55, // constant pull back down the face
  faceDrag: 3.2, // velocity damping, higher = less floaty
  minH: 0.03,
  maxH: 1.0,

  // --- Forward speed ---
  // Speed scales with how low you are on the face: drop down the line to go
  // fast, climb to the lip to slow down and set up.
  baseSpeed: 300,
  speedFromDifficulty: 260,
  speedAtLip: 0.86,
  speedAtTrough: 1.18,
  speedResponse: 2.2, // how quickly actual speed chases target speed

  // --- Pumping (space bar when you're too low to launch) ---
  pumpBoost: 130,
  pumpCooldown: 0.55,

  // --- Launching ---
  launchMinH: 0.5,
  popBase: 460,
  popFromH: 340,
  popFromSpeed: 240, // late-run speed buys enough hang time for a 720
  airForwardBase: 34,
  airForwardFromPop: 90,
  airDriftReturn: 2.4, // how fast x eases back to homeX after landing
  gravity: 1450,
  diveAccel: 1100, // holding down in the air pulls you back to the wave

  // --- Spinning ---
  // Tuned so holding the key for most of an air is roughly one rotation, and
  // letting go settles the board quickly: hold to spin, release to stomp it.
  spinAccel: 20,
  spinMax: 10.5, // radians / second
  spinDamping: 6,
  // Let go of the spin and the board eases to the nearest upright, the way a
  // board wants to be flat. Holding the spin all the way to the water still
  // ends badly — you have to set the landing up.
  spinSettle: 7,
  grabSpinScale: 0.55,

  // --- Landing ---
  landingTolerance: 0.87, // radians (~50 degrees) either side of upright
  landingH: 0.86,
  landingDropIn: -0.3, // a nudge back down the face on touchdown
  cleanLandingBoost: 1.08,
};

export const CAMERA = {
  // When the surfer climbs above this screen line the camera pans with them.
  followLine: 150,
  ease: 6,
  shakeDecay: 5.5,
};

export const DIFFICULTY = {
  // Distance (in px) at which the game reaches full speed and density.
  rampDistance: 26000,
  spawnGapEasy: 1.55, // seconds between spawns at the start
  spawnGapHard: 0.62,
  spawnJitter: 0.35,
  // A new obstacle is never placed if it would leave the player less than this
  // much time to react to it given the current speed.
  minReactionSeconds: 0.7,
  seagullsAfter: 2600,
  barrelsAfter: 5200,
  barrelInterval: 3400, // distance between barrel sections
  barrelIntervalJitter: 1200,
};

export const BARREL = {
  duration: 4.6, // seconds
  safeLow: 0.44,
  safeHigh: 0.9,
  pocketLow: 0.58, // the sweet spot scores fastest
  pocketHigh: 0.86,
  scorePerSecond: 220,
  pocketBonusPerSecond: 260,
  lipPush: 2.4, // the falling lip shoves you down if you climb too high
};

export const SCORING = {
  pointsPerPixel: 1 / 12,
  air: 120, // straight air, scaled by hang time
  spin: [0, 500, 1400, 2800, 4600], // index = completed rotations
  spinOverflow: 2200, // per rotation beyond the table
  grabPerSecond: 260,
  nearMiss: 40,
  comboStep: 0.5, // each landed trick adds this to the multiplier
  comboMax: 4,
  minAirTimeForPoints: 0.32,
};

export const PALETTE = {
  skyTop: '#12406b',
  skyMid: '#3f8fbe',
  skyLow: '#a8dcea',
  skyHorizon: '#ffe0b4',
  sun: '#fff6d4',
  sunGlow: 'rgba(255, 226, 158, 0.55)',
  cloud: 'rgba(255, 250, 244, 0.92)',
  cloudShade: 'rgba(206, 226, 240, 0.85)',
  headland: '#1d4f63',
  backSwell: '#1b6a7d',
  backSwellFoam: 'rgba(233, 253, 255, 0.75)',
  faceTop: '#4fd2d6',
  faceMid: '#12879b',
  faceDeep: '#053f52',
  faceGlass: 'rgba(180, 249, 255, 0.20)',
  foam: '#f4feff',
  foamShade: 'rgba(196, 236, 242, 0.9)',
  spray: 'rgba(248, 255, 255, 0.9)',
  ink: '#0a2b38',
  hud: '#f6feff',
  gold: '#ffd465',
  danger: '#ff6b5e',
};

export const STORAGE_KEYS = {
  highScore: 'surfsup.highScore',
  muted: 'surfsup.muted',
  bestTrick: 'surfsup.bestTrick',
  played: 'surfsup.played',
};
