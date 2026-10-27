// ─────────────────────────────────────────────────────────────
//  LUDUS — tunable settings
//  All lengths are metres in the model's space (ball ⌀ ≈ 0.20).
// ─────────────────────────────────────────────────────────────

export const OUTCOMES = {
  // Base probabilities for a *valid* grab (they are normalised, so they
  // don't have to add up to exactly 1).
  bounceOff: 0.25, // A — squeezed, then springs out sideways
  slipMid: 0.3, //    B — held, then slips out while recovering its shape
  nearMiss: 0.3, //   C — lifted almost to the success line, then slips
  success: 0.15, //   D — held firmly all the way above the line
};

export const PITY = {
  startAfterFails: 3, // consecutive failed valid grabs before help starts
  successStep: 0.07, // + success weight per extra fail
  maxSuccess: 0.6, // cap for the success weight
};

// How much a sloppy grab (off-centre, tips too high) worsens the odds (0 = no influence).
// A clean grab always uses the OUTCOMES rates above.
export const ALIGNMENT_INFLUENCE = 0.5;

export const CLAW = {
  xLimit: 0.44, // claw travels between -xLimit … +xLimit
  yMax: 0.78, // highest hinge height
  followX: 16, // horizontal follow responsiveness (1/s, higher = snappier)
  followY: 9, // vertical follow responsiveness
  maxSpeedY: 1.1, // m/s
  wheelStep: 0.00045, // metres per wheel pixel (one notch ≈ 100px ≈ 4.5 cm)
  wheelMaxPerEvent: 0.07,
  closeSpeedDeg: 85, // arm angular speed (deg/s) while closing
  openSpeedDeg: 110, // arm angular speed while opening
  closedEmptyDeg: 32, // fully closed with nothing inside
};

export const BALL = {
  gravity: 6.2, // m/s² (slightly floaty, jelly feel)
  floorStiffness: 3300, // contact spring → squash depth on landing
  floorDamping: 21, // energy loss per bounce (restitution ≈ 0.55)
  rollFriction: 1.4,
  zReturn: 7, // gentle tray slope that brings the ball back to the claw's plane
  xLimit: 0.45,
  zMin: -0.32,
  zMax: 0.3,
  wobbleStiffness: 240,
  wobbleDamping: 5.2,
};

export const GRIP = {
  squeezeDepth: 0.014, // how deep the arms press in when grabbing
  squeezeTime: 0.3, // seconds to reach full squeeze
  holdDepth: { slipMid: 0.0045, nearMiss: 0.006, success: 0.0095 },
  slipAllowance: 0.0022,
  centreTolerance: 0.05, // max horizontal offset for a valid grab
  tipAboveCentre: 0.012, // tips must be at most this far above the ball centre
};

// Variation ranges (picked randomly per attempt)
export const VARIATION = {
  popDelay: [0.16, 0.42], // A: time squeezed before popping out
  popSpeed: [0.55, 1.05],
  popUp: [0.15, 0.55],
  slipLift: [0.05, 0.17], // B: lift height (m) at which slipping starts
  slipTime: [2.6, 4.6], //   B: or after holding this long without lifting
  nearGap: [0.012, 0.055], // C: distance below the line where it slips
  creepTime: [0.18, 0.55], // C: slow creep before the real slide
  slipAccel: [0.7, 1.6],
  slipDrift: [0.004, 0.018],
};

export const SUCCESS = {
  lineY: 0.48, // world height of the success line
  holdSeconds: 2.6, // feedback duration before the claw lets go
};
