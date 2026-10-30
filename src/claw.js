import * as THREE from 'three';
import { CLAW } from './config.js';

const D2R = Math.PI / 180;
const WIRE_TOP = 2.4; // world height the cable reaches (always above the frame)
const _w = new THREE.Vector3();

// The three-pronged claw from the GLB.
// Arm hinge rotation: Blender local +Y  ==  three.js local -Z  (arm.rotation.z = -angle).
export class Claw {
  constructor(node) {
    this.node = node;
    this.pos = node.position; // x/y driven by the visitor
    this.vel = new THREE.Vector3();
    this.target = new THREE.Vector2(0, node.position.y);
    this.closed = false; // toggled by left click
    this.aUser = 0; // commanded closing angle (rad)

    this.arms = [1, 2, 3].map((i) => {
      const arm = node.getObjectByName(`Claw_Arm_0${i}`);
      const raw = arm.userData.collision_pts;
      const pts = [];
      for (let k = 0; k < raw.length; k += 4) pts.push({ x: raw[k], y: raw[k + 1], z: raw[k + 2], r: raw[k + 3] });
      return {
        arm,
        pivot: arm.parent,
        pts,
        angle: 0,
        limited: false,
        pen: -1,
        contact: new THREE.Vector3(),
        tip: new THREE.Vector3(),
        lastPush: 0,
      };
    });

    // Rough body volume (claw-local) used to stop the claw on top of the ball.
    this.body = [
      { c: new THREE.Vector3(0, -0.008, 0), r: 0.02 },
      { c: new THREE.Vector3(0, 0.003, 0), r: 0.035 },
      { c: new THREE.Vector3(0, 0.045, 0), r: 0.031 },
    ];

    // Cable: rebase so it can be lengthened like a real claw cable.
    this.wire = node.getObjectByName('Claw_Wire');
    const g = this.wire.geometry;
    g.computeBoundingBox();
    this.wireY0 = g.boundingBox.min.y;
    this.wireLen = g.boundingBox.max.y - g.boundingBox.min.y;
    g.translate(0, -this.wireY0, 0);
    this.wire.position.y = this.wireY0;

    this.lowestOffset = -0.172;
    this.closedAngle = CLAW.closedEmptyDeg * D2R;
  }

  reset(y) {
    this.pos.set(0, y, 0);
    this.target.set(0, y);
    this.vel.set(0, 0, 0);
    this.closed = false;
    this.aUser = 0;
    for (const a of this.arms) {
      a.angle = 0;
      a.limited = false;
      a.pen = -1;
      a.lastPush = 0;
      a.arm.rotation.z = 0;
    }
    this.wire.scale.y = Math.max(0.05, (WIRE_TOP - (y + this.wireY0)) / this.wireLen);
    this.node.updateMatrixWorld(true);
  }

  // ── movement ────────────────────────────────────────────────
  move(dt, minY) {
    const p = this.pos;
    const ox = p.x;
    const oy = p.y;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -CLAW.xLimit, CLAW.xLimit);
    this.target.y = THREE.MathUtils.clamp(this.target.y, minY, CLAW.yMax);
    p.x += (this.target.x - p.x) * (1 - Math.exp(-CLAW.followX * dt));
    let dy = (this.target.y - p.y) * (1 - Math.exp(-CLAW.followY * dt));
    const maxStep = CLAW.maxSpeedY * dt;
    dy = THREE.MathUtils.clamp(dy, -maxStep, maxStep);
    p.y = Math.max(p.y + dy, minY);
    p.y = Math.min(p.y, CLAW.yMax);
    if (dt > 0) this.vel.set((p.x - ox) / dt, (p.y - oy) / dt, 0);
    this.wire.scale.y = Math.max(0.05, (WIRE_TOP - (p.y + this.wireY0)) / this.wireLen);
    this.node.updateMatrixWorld(true);
  }

  animateCommand(dt) {
    const goal = this.closed ? this.closedAngle : 0;
    const sp = (this.closed ? CLAW.closeSpeedDeg : CLAW.openSpeedDeg) * D2R * dt;
    this.aUser += THREE.MathUtils.clamp(goal - this.aUser, -sp, sp);
  }

  // ── arm kinematics ─────────────────────────────────────────
  armPointWorld(a, p, ang, out) {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    out.set(p.x * c + p.y * s, -p.x * s + p.y * c, p.z);
    return out.applyMatrix4(a.pivot.matrixWorld);
  }

  // Deepest penetration of one arm into the ball at a given angle.
  penetration(a, ang, ball, storeContact = false) {
    let best = -1;
    const C = ball.pos;
    for (const p of a.pts) {
      this.armPointWorld(a, p, ang, _w);
      const dx = _w.x - C.x;
      const dyRaw = _w.y - C.y;
      const dy = dyRaw * (ball.R / (dyRaw > 0 ? ball.Rtop : ball.Rbot));
      const dz = _w.z - C.z;
      const pen = ball.R + p.r - Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (pen > best) {
        best = pen;
        if (storeContact) a.contact.copy(_w);
      }
    }
    return best;
  }

  // Largest angle in [lo, hi] whose penetration stays within `allow`.
  solve(a, lo, hi, ball, allow) {
    if (this.penetration(a, hi, ball) <= allow) return hi;
    if (this.penetration(a, lo, ball) > allow) return lo;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (this.penetration(a, mid, ball) > allow) hi = mid;
      else lo = mid;
    }
    return lo;
  }

  // freeBall: arms only stop closing on the ball; heldBall: the ball can push arms open.
  updateArms(ball, allow, mode) {
    let lowest = Infinity;
    for (const a of this.arms) {
      let ang;
      if (!ball || mode === 'ghost') ang = this.aUser;
      else if (mode === 'free') {
        ang = this.aUser <= a.angle ? this.aUser : this.solve(a, a.angle, this.aUser, ball, allow);
      } else ang = this.solve(a, 0, this.aUser, ball, allow);
      a.limited = ang < this.aUser - 0.002;
      a.angle = ang;
      a.arm.rotation.z = -ang;
      a.pen = ball ? this.penetration(a, ang, ball, true) : -1;
      this.armPointWorld(a, a.pts[a.pts.length - 1], ang, a.tip);
      for (const p of a.pts) {
        this.armPointWorld(a, p, ang, _w);
        lowest = Math.min(lowest, _w.y - p.r);
      }
    }
    this.lowestOffset = lowest - this.pos.y;
    this.node.updateMatrixWorld(true);
  }

  lowestTipY() {
    return Math.min(...this.arms.map((a) => a.tip.y)) - 0.006;
  }
}
