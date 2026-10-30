// ─────────────────────────────────────────────────────────────
//  LUDUS — tunable settings
//  All lengths are metres in the model's space (ball ⌀ ≈ 0.20).
// ─────────────────────────────────────────────────────────────

// ── DIFFICULTY ───────────────────────────────────────────────

export const OUTCOMES = {
  // Base probabilities for a *valid*, well-centred grab (normalised, so they
  // don't have to add up to exactly 1). The result is decided ONCE per grab,
  // never per frame.
  bounceOff: 0.34, // A — squeezed, then springs out of the claw
  slipMid: 0.3, //    B — held, then slips out while recovering its shape
  nearMiss: 0.26, //  C — lifted almost to the success line, then slips
  success: 0.1, //    D — held firmly all the way above the line
};

export const PITY = {
  startAfterFails: 4, // consecutive failed grabs before the ball starts to "give in"
  successStep: 0.04, // + success weight per extra fail
  maxSuccess: 0.32, // cap for the success weight
};

// How much a sloppy grab (off-centre, tips too high) worsens the odds (0 = no influence).
// A perfectly centred grab uses the OUTCOMES rates above; the further off, the more
// often the ball squirts out (A) and the less often it can be won (D).
export const ALIGNMENT_INFLUENCE = 0.85;

export const GRIP = {
  squeezeDepth: 0.014, // how deep the arms press in when grabbing
  squeezeTime: 0.3, // seconds to reach full squeeze
  holdDepth: { slipMid: 0.0045, nearMiss: 0.006, success: 0.0095 },
  slipAllowance: 0.0022,
  centreTolerance: 0.04, // max horizontal offset (m) for the ball to be caught at all
  cleanRadius: 0.008, //   offset that still counts as "perfectly centred"
  tipAboveCentre: 0.012, // tips must be at most this far above the ball centre
};

// While held, the ball is never glued to the claw: it lags behind claw motion
// and (for outcomes that will fail) slowly sags in the grip.
export const HOLD = {
  swayStiffness: 140,
  swayDamping: 9,
  swayAmount: 0.010, // how far (m) it lags per m/s² of claw acceleration
  swayMax: 0.018,
  sagSpeed: 0.006, // m/s slow sag before a slip (B, C)
  sagMax: 0.012,
};

// Variation ranges (picked randomly per attempt)
export const VARIATION = {
  popDelay: [0.16, 0.42], // A: time squeezed before popping out
  popSpeed: [0.55, 1.05],
  popUp: [0.15, 0.55],
  slipLift: [0.06, 0.32], // B: lift height (m) at which slipping starts
  slipTime: [2.6, 4.6], //   B: or after holding this long without lifting
  nearGap: [0.012, 0.07], // C: distance below the line where it slips
  creepTime: [0.18, 0.55], // C: slow creep before the real slide
  slipAccel: [0.7, 1.6],
  slipDrift: [0.004, 0.018],
};

// ── SUCCESS ──────────────────────────────────────────────────

export const SUCCESS = {
  lineY: 0.63, // world height of the success line (the whole ball must pass it)
  bounceHeight: 0.014, // happy hops of the ball inside the claw
  bounceCount: 2,
  textDelay: 0.55, // s after reaching the line before "Okay, you win!" appears
  buttonDelay: 1.4, // s before "다시 잡아볼래?" appears
};

// ── BALL MATERIAL (transparency) ─────────────────────────────

export const ORB = {
  density: 0.62, // overall gel thickness (lower = more transparent)
  clearCore: 0.62, // 0 = uniform, 1 = very clear centre with denser skin
  rimGlow: 0.42, // brightness of the mint / ice-blue edge
};

// ── MOTION / CONTROLS ────────────────────────────────────────

export const CLAW = {
  xLimit: 0.44, // claw travels between -xLimit … +xLimit (narrower on portrait phones)
  yMax: 0.88, // highest hinge height
  yMinSlider: 0.12, // bottom of the touch slider range (the claw still stops on the floor/ball)
  followX: 16, // horizontal follow responsiveness (1/s, higher = snappier)
  followY: 9, // vertical follow responsiveness
  maxSpeedY: 1.1, // m/s
  wheelStep: 0.00045, // metres per wheel pixel (one notch ≈ 100px ≈ 4.5 cm)
  wheelMaxPerEvent: 0.07,
  touchDragGain: 1.0, // 1 = claw follows the finger 1:1
  closeSpeedDeg: 85, // arm angular speed (deg/s) while closing
  openSpeedDeg: 110, // arm angular speed while opening
  closedEmptyDeg: 32, // fully closed with nothing inside
  startY: 0.56,
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

// Play-field width per screen shape (applied on resize).
export const PLAYFIELD = {
  wide: { clawX: 0.44, ballX: 0.45, viewHalfWidth: 0.68 },
  portrait: { clawX: 0.3, ballX: 0.31, viewHalfWidth: 0.47 },
};
