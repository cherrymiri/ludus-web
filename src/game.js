import * as THREE from 'three';
import { OUTCOMES, PITY, ALIGNMENT_INFLUENCE, GRIP, HOLD, VARIATION, SUCCESS, CLAW } from './config.js';

const rand = ([a, b]) => a + Math.random() * (b - a);
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const easeOutBack = (t) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _acc = new THREE.Vector3();

// States: free → grip → (pop → free) | held → (slip → free) | success (stays until reset())
export class Game {
  constructor({ claw, ball, hud }) {
    this.claw = claw;
    this.ball = ball;
    this.hud = hud;
    this.state = 'free';
    this.outcome = null;
    this.p = {}; // per-attempt random parameters
    this.rel = new THREE.Vector3();
    this.t = 0;
    this.ghost = 0;
    this.fails = 0;
    this.depth = 0;
    this.forced = null; // for testing: window.__LUDUS.force('success')
    this.log = [];
    // held-ball sway (so it never looks glued to the claw)
    this.lag = new THREE.Vector3();
    this.lagV = new THREE.Vector3();
    this.prevClawVel = new THREE.Vector3();
    this.sag = 0;
    this.successCount = 0;
    this.resetting = false;
  }

  // No claw control while the win screen is up (or while resetting).
  get locked() {
    return this.state === 'success' || this.resetting;
  }

  // Back to a fresh attempt without reloading anything.
  reset() {
    this.state = 'free';
    this.outcome = null;
    this.p = {};
    this.rel.set(0, 0, 0);
    this.lag.set(0, 0, 0);
    this.lagV.set(0, 0, 0);
    this.prevClawVel.set(0, 0, 0);
    this.sag = 0;
    this.t = 0;
    this.ghost = 0;
    this.depth = 0;
    this.fails = 0;
    this.grabBottom = 0;
    this.claw.reset(CLAW.startY);
    this.ball.reset();
    this.claw.updateArms(this.ball, 0.002, 'free');
    this.collectDents();
    this.ball.deform();
  }

  get holding() {
    return this.state === 'grip' || this.state === 'held' || this.state === 'slip' || this.state === 'success';
  }

  toggle() {
    if (this.locked) return;
    const c = this.claw;
    c.closed = !c.closed;
    if (!c.closed && this.holding) this.release('opened');
  }

  // ── outcome choice ───────────────────────────────────────────
  chooseOutcome(quality) {
    if (this.forced) return this.forced;
    const w = { ...OUTCOMES };
    const inf = ALIGNMENT_INFLUENCE;
    // a clean, centred, low grab uses the configured rates as-is;
    // a sloppy one (off-centre / tips high) bounces off more and succeeds less
    const sloppy = 1 - THREE.MathUtils.clamp(quality, 0, 1);
    w.success *= 1 - inf * sloppy * 1.2;
    w.bounceOff *= 1 + inf * sloppy * 1.6;
    const extra = Math.max(0, this.fails - PITY.startAfterFails + 1);
    w.success = Math.min(PITY.maxSuccess, w.success + extra * PITY.successStep);
    const sum = w.bounceOff + w.slipMid + w.nearMiss + w.success;
    let r = Math.random() * sum;
    for (const k of ['bounceOff', 'slipMid', 'nearMiss', 'success']) {
      r -= w[k];
      if (r <= 0) return k;
    }
    return 'success';
  }

  startGrip(hd, tipY) {
    const b = this.ball;
    const quality =
      1 -
      Math.min(1, Math.max(0, hd - GRIP.cleanRadius) / (GRIP.centreTolerance - GRIP.cleanRadius)) * 0.6 -
      THREE.MathUtils.clamp((tipY - (b.pos.y - 0.035)) / 0.045, 0, 1) * 0.4;
    this.outcome = this.chooseOutcome(quality);
    this.state = 'grip';
    this.t = 0;
    this.rel.copy(b.pos).sub(this.claw.pos);
    this.lag.set(0, 0, 0);
    this.lagV.set(0, 0, 0);
    this.sag = 0;
    b.vel.set(0, 0, 0);
    b.omega.set(0, 0, 0);
    b.floorSquash = 1;
    this.p = {
      popDelay: rand(VARIATION.popDelay),
      popSpeed: rand(VARIATION.popSpeed),
      popUp: rand(VARIATION.popUp),
      slipLift: rand(VARIATION.slipLift),
      slipTime: rand(VARIATION.slipTime),
      nearGap: rand(VARIATION.nearGap),
      creepTime: rand(VARIATION.creepTime),
      creepSpeed: rand([0.025, 0.06]),
      slipAccel: rand(VARIATION.slipAccel),
      drift: new THREE.Vector3(sign() * rand(VARIATION.slipDrift), 0, rand([-1, 1]) * rand(VARIATION.slipDrift)),
      popSide: Math.abs(this.rel.x) > 0.008 ? Math.sign(this.rel.x) : sign(),
      quality,
    };
    b.kick(0.25, 0);
    this.log.push({ t: performance.now(), outcome: this.outcome, quality: +quality.toFixed(2), fails: this.fails });
  }

  pop(strength = 1, counted = true) {
    const b = this.ball;
    this.state = 'free';
    const phi = this.p.popSide * THREE.MathUtils.degToRad(rand([18, 58]));
    const sp = this.p.popSpeed * strength;
    b.vel.set(Math.sin(phi) * sp, this.p.popUp * strength, Math.cos(phi) * sp * 0.75).add(this.claw.vel);
    b.omega.set(b.vel.z / b.R, 0, -b.vel.x / b.R);
    b.kick(0.9 * strength, 0.5 * strength * sign());
    this.ghost = 0.34;
    if (counted) this.fails++;
  }

  release(reason) {
    const b = this.ball;
    this.state = 'free';
    b.vel.copy(this.claw.vel);
    b.vel.y = Math.min(b.vel.y, 0.2);
    if (reason === 'slip') {
      b.vel.y -= this.p.sv || 0;
      b.vel.add(this.p.drift.clone().multiplyScalar(6));
    }
    b.omega.set(b.vel.z / b.R, 0, -b.vel.x / b.R);
    b.kick(0.35, 0.15 * sign());
    this.ghost = 0.12;
  }

  startSlip() {
    this.state = 'slip';
    this.t = 0;
    this.p.sv = 0;
    this.fails++;
    this.ball.kick(0.3, 0.12 * sign());
  }

  // ── per-frame ────────────────────────────────────────────────
  update(dt) {
    const c = this.claw;
    const b = this.ball;
    c.animateCommand(dt);

    // 1. claw position (with floor / ball limits)
    let minY = 0.004 - c.lowestOffset;
    if (this.holding) minY = Math.max(minY, b.Rbot + 0.003 - this.rel.y);
    else if (this.ghost <= 0) minY = Math.max(minY, this.bodyBlockY());
    c.move(dt, minY);

    // 2. ball
    if (this.ghost > 0) this.ghost -= dt;
    if (this.holding) {
      if (this.state !== 'success') this.updateSway(dt);
      b.pos.copy(c.pos).add(this.rel).add(this.lag);
      b.grounded = false;
      b.floorSquash = 1;
    } else {
      const n = Math.max(1, Math.ceil(dt / (1 / 240)));
      for (let i = 0; i < n; i++) b.stepFree(dt / n);
    }

    // 3. arms
    let allow = 0.002;
    let mode = 'free';
    if (this.ghost > 0 && !this.holding) {
      // escaping jelly shoves the arms open instead of passing through them
      mode = 'held';
      allow = 0.016;
    }
    if (this.state === 'grip') {
      mode = 'held';
      allow = GRIP.squeezeDepth * easeOutBack(Math.min(1, this.t / GRIP.squeezeTime));
    } else if (this.state === 'held' || this.state === 'success') {
      mode = 'held';
      allow = this.depth;
    } else if (this.state === 'slip') {
      mode = 'held';
      allow = GRIP.slipAllowance;
    }
    c.updateArms(b, allow, mode);

    // 4. state logic
    if (this.state === 'free') this.updateFree(dt);
    else this[`update_${this.state}`](dt);

    // 5. deformation
    this.collectDents();
    b.stepSecondary(dt);
    b.deform();
  }

  // The held ball lags behind the claw's acceleration like a soft weight on a spring.
  updateSway(dt) {
    const c = this.claw;
    if (dt <= 0) return;
    _acc.copy(c.vel).sub(this.prevClawVel).divideScalar(dt);
    this.prevClawVel.copy(c.vel);
    _acc.clampLength(0, 12);
    const k = HOLD.swayStiffness;
    const d = HOLD.swayDamping;
    this.lagV.x += (-k * this.lag.x - d * this.lagV.x - _acc.x * HOLD.swayAmount * k) * dt;
    this.lagV.y += (-k * this.lag.y - d * this.lagV.y - _acc.y * HOLD.swayAmount * k * 0.6) * dt;
    this.lag.addScaledVector(this.lagV, dt);
    this.lag.z = 0;
    if (this.lag.length() > HOLD.swayMax) this.lag.setLength(HOLD.swayMax);
    this.ball.jigV += -_acc.x * 0.004;
  }

  // Claw cannot descend through the top of a resting/free ball.
  bodyBlockY() {
    const c = this.claw;
    const b = this.ball;
    let req = -Infinity;
    for (const s of c.body) {
      const hx = c.pos.x + s.c.x - b.pos.x;
      const hz = s.c.z - b.pos.z;
      const rr = b.R + s.r;
      const h2 = hx * hx + hz * hz;
      if (h2 >= rr * rr) continue;
      if (c.pos.y + s.c.y < b.pos.y) continue;
      const vertical = Math.sqrt(rr * rr - h2) * (b.Rtop / b.R);
      req = Math.max(req, b.pos.y + vertical - s.c.y - 0.004);
    }
    return req;
  }

  updateFree(dt) {
    const c = this.claw;
    const b = this.ball;
    if (this.ghost > 0) return;

    // push the ball when the (open or closed) claw moves into it
    for (const a of c.arms) {
      if (a.pen <= 0.0025) continue;
      _n.copy(b.pos).sub(a.contact);
      const grounded = b.pos.y <= b.Rbot + 0.004;
      if (grounded) _n.y = 0;
      if (_n.lengthSq() < 1e-8) _n.set(Math.sign(b.pos.x - c.pos.x) || 1, 0, 0);
      _n.normalize();
      const push = Math.min(0.02, a.pen - 0.002);
      b.pos.addScaledVector(_n, push);
      b.vel.addScaledVector(_n, Math.min(1.2, push / Math.max(dt, 1e-3)) * 0.5);
      b.omega.set(b.vel.z / b.R, 0, -b.vel.x / b.R);
    }

    if (!c.closed) return;
    const touching = c.arms.filter((a) => a.limited);
    if (!touching.length) return;

    const hd = Math.hypot(b.pos.x - c.pos.x, b.pos.z);
    const tipY = c.lowestTipY();
    const slow = b.vel.length() < 0.7;
    const valid = hd < GRIP.centreTolerance && tipY <= b.pos.y + GRIP.tipAboveCentre && slow;

    if (valid && touching.length >= 2) {
      this.startGrip(hd, tipY);
      return;
    }
    const saturated = c.aUser >= c.closedAngle - 0.01;
    if (!valid && touching.length >= 2) {
      // pressed from above / off-centre: the jelly squirts out (not a real attempt)
      this.p = { popSpeed: rand([0.35, 0.6]), popUp: rand([0.1, 0.3]), popSide: Math.sign(b.pos.x - c.pos.x) || sign() };
      this.pop(1, false);
      return;
    }
    if (touching.length === 1 && (!valid || saturated)) {
      const a = touching[0];
      const now = performance.now();
      if (now - a.lastPush > 250) {
        a.lastPush = now;
        _n.copy(b.pos).sub(a.contact);
        _n.y = 0;
        _n.normalize();
        b.vel.addScaledVector(_n, rand([0.25, 0.45]));
        b.omega.set(b.vel.z / b.R, 0, -b.vel.x / b.R);
        b.kick(0.2, 0.15);
      }
    }
  }

  update_grip(dt) {
    this.t += dt;
    const k = Math.exp(-dt * 7);
    this.rel.x *= k;
    this.rel.z *= k;
    if (this.outcome === 'bounceOff') {
      // keep squeezing until the jelly gives way
      if (this.t >= this.p.popDelay) this.pop(1, true);
      return;
    }
    if (this.t >= GRIP.squeezeTime) {
      this.state = 'held';
      this.t = 0;
      this.depth = GRIP.squeezeDepth;
      this.grabBottom = this.ball.bottom();
    }
  }

  update_held(dt) {
    const b = this.ball;
    this.t += dt;
    const bottom = b.bottom();
    const lift = Math.max(0, bottom - this.grabBottom);
    const recov = THREE.MathUtils.clamp(lift / 0.28 + this.t * 0.07, 0, 1);
    const hold = GRIP.holdDepth[this.outcome] ?? GRIP.holdDepth.success;
    this.depth = THREE.MathUtils.lerp(GRIP.squeezeDepth, hold, recov * recov * (3 - 2 * recov));

    // outcomes that will fail sag slowly in the grip — it never feels locked in
    if (this.outcome !== 'success' && this.sag < HOLD.sagMax) {
      const ds = HOLD.sagSpeed * dt;
      this.sag += ds;
      this.rel.y -= ds;
    }

    const line = SUCCESS.lineY;
    if (this.outcome === 'success') {
      // judged on the real ball, while it is really held
      if (bottom > line) this.startSuccess();
      return;
    }
    if (bottom > line - 0.004) return this.startSlip();
    if (this.outcome === 'slipMid' && (lift > this.p.slipLift || this.t > this.p.slipTime)) return this.startSlip();
    if (this.outcome === 'nearMiss' && bottom > line - this.p.nearGap) return this.startSlip();
  }

  update_slip(dt) {
    const b = this.ball;
    const c = this.claw;
    const p = this.p;
    this.t += dt;
    if (this.outcome === 'nearMiss' && this.t < p.creepTime) p.sv = p.creepSpeed;
    else p.sv += p.slipAccel * dt;
    this.rel.y -= p.sv * dt;
    this.rel.addScaledVector(p.drift, dt);
    // never let a slipping ball cross the line
    const over = c.pos.y + this.rel.y - b.Rbot - (SUCCESS.lineY - 0.004);
    if (over > 0) this.rel.y -= over;
    b.omega.set(p.drift.z * 40, 0, -p.drift.x * 40);
    b.pos.copy(c.pos).add(this.rel).add(this.lag);
    if (b.top() < c.lowestTipY() - 0.004 || b.bottom() <= 0.004) this.release('slip');
  }

  startSuccess() {
    if (this.state === 'success') return; // judged once
    this.state = 'success';
    this.successCount++;
    this.t = 0;
    this.fails = 0;
    // settle the ball where it is (sway folded in), never back below the line
    this.rel.add(this.lag);
    this.lag.set(0, 0, 0);
    this.lagV.set(0, 0, 0);
    this.hopBase = Math.max(this.rel.y, SUCCESS.lineY + this.ball.Rbot + 0.008 - this.claw.pos.y);
    this.hopsDone = 0;
    this.claw.target.set(this.claw.pos.x, this.claw.pos.y); // freeze the claw where it is
    this.ball.glow = 1;
    this.ball.kick(0.35, 0);
  }

  // The ball gives in: a couple of happy hops inside the claw, then it stays put.
  update_success(dt) {
    this.t += dt;
    const T = 0.34;
    const n = SUCCESS.bounceCount;
    const t = this.t - 0.12;
    let hop = 0;
    if (t > 0 && t < n * T) {
      const k = Math.floor(t / T);
      hop = SUCCESS.bounceHeight * Math.pow(0.6, k) * Math.sin((Math.PI * (t - k * T)) / T);
      if (k + 1 > this.hopsDone && t - k * T > T * 0.92) {
        this.hopsDone = k + 1;
        this.ball.kick(-0.9 * Math.pow(0.6, k), 0.12);
      }
    }
    this.rel.y = this.hopBase + Math.max(0, hop);
    this.ball.glow = Math.max(this.ball.glow, 0.35 + 0.25 * Math.sin(this.t * 2.2));
  }

  collectDents() {
    const b = this.ball;
    const c = this.claw;
    const dents = [];
    for (const a of c.arms) {
      if (a.pen <= 0) continue;
      const u = _v.copy(a.contact).sub(b.pos);
      if (u.lengthSq() < 1e-8) continue;
      // arms squeeze from the sides: keep the press direction mostly horizontal
      u.y *= 0.35;
      dents.push({ u: u.normalize().clone(), d: Math.min(0.022, a.pen) });
    }
    // claw hub pressing the top
    if (!this.holding) {
      for (const s of c.body) {
        const w = _v.copy(s.c).add(c.pos);
        const d = w.sub(b.pos);
        const dist = d.length();
        const pen = b.R + s.r - dist - 0.004;
        if (pen > 0) dents.push({ u: d.normalize().clone(), d: Math.min(0.02, pen) });
      }
    }
    b.dents = dents;
  }
}
