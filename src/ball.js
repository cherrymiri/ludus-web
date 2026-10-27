import * as THREE from 'three';
import { BALL } from './config.js';

const _q = new THREE.Quaternion();
const _ax = new THREE.Vector3();
const _m4 = new THREE.Matrix4();

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The squishy ball: per-vertex deformation of the original GLB mesh
// (dents where arms press, volume bulge, floor squash, jelly wobble)
// plus a lightweight rigid-body for falling / bouncing / rolling.
export class Ball {
  constructor(mesh, makeBody, skin) {
    this.mesh = mesh;
    const geo = mesh.geometry;
    this.geo = geo;
    const pos = geo.attributes.position;
    pos.setUsage(THREE.DynamicDrawUsage);
    this.base = Float32Array.from(pos.array);
    this.n = pos.count;
    this.dirs = new Float32Array(this.n * 3);
    let R = 0;
    let top = 0;
    let bot = 0;
    for (let i = 0; i < this.n; i++) {
      const x = this.base[i * 3];
      const y = this.base[i * 3 + 1];
      const z = this.base[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      this.dirs[i * 3] = x / l;
      this.dirs[i * 3 + 1] = y / l;
      this.dirs[i * 3 + 2] = z / l;
      R = Math.max(R, Math.hypot(x, z));
      top = Math.max(top, y);
      bot = Math.min(bot, y);
    }
    this.R = R;
    this.Rtop = top;
    this.Rbot = -bot;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 1.6);

    // gel body (volume shader) + glossy skin share the deformed geometry
    mesh.material = makeBody(R, top);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    this.skin = new THREE.Mesh(geo, skin);
    this.skin.renderOrder = 2;
    this.skin.frustumCulled = false;
    mesh.add(this.skin);
    this.uniforms = mesh.material.uniforms;

    this.pos = mesh.position;
    this.vel = new THREE.Vector3();
    this.omega = new THREE.Vector3();
    this.spin = new THREE.Quaternion();
    this.wob = 0; // vertical stretch (+) / squash (−)
    this.wobV = 0;
    this.jig = 0; // x-vs-z wobble
    this.jigV = 0;
    this.grounded = true;
    this.floorSquash = 1;
    this.dents = []; // { u: Vector3 (ball-local unit), d: depth }
    this.glow = 0;
  }

  bottom() {
    return this.pos.y - this.Rbot * this.floorSquash * (1 + Math.min(0, this.wob));
  }
  top() {
    return this.pos.y + this.Rtop;
  }

  kick(stretch, jiggle = 0) {
    this.wobV += stretch;
    this.jigV += jiggle;
  }

  // ── free rigid-body step ─────────────────────────────────────
  stepFree(dt) {
    const v = this.vel;
    const p = this.pos;
    v.y -= BALL.gravity * dt;
    v.z += -BALL.zReturn * p.z * dt;
    p.addScaledVector(v, dt);

    const pen = this.Rbot - p.y;
    const wasGrounded = this.grounded;
    if (pen > 0) {
      if (!wasGrounded && v.y < -0.25) this.kick(v.y * 1.6, (Math.random() - 0.5) * Math.abs(v.y) * 0.8);
      const acc = BALL.floorStiffness * pen - BALL.floorDamping * v.y;
      v.y += Math.max(0, acc) * dt;
      const f = Math.exp(-BALL.rollFriction * dt);
      v.x *= f;
      v.z *= f;
      this.grounded = true;
      // rolling without slipping
      this.omega.set(v.z / this.R, 0, -v.x / this.R);
    } else {
      this.grounded = pen > -0.002;
    }
    // walls (keep the ball in view)
    if (Math.abs(p.x) > BALL.xLimit) {
      p.x = Math.sign(p.x) * BALL.xLimit;
      v.x *= -0.45;
      this.kick(0, 0.08);
    }
    if (p.z > BALL.zMax) {
      p.z = BALL.zMax;
      v.z *= -0.4;
    }
    if (p.z < BALL.zMin) {
      p.z = BALL.zMin;
      v.z *= -0.4;
    }
    if (p.y < this.Rbot * 0.5) {
      p.y = this.Rbot * 0.5;
      v.y = Math.max(0, v.y);
    }
    this.floorSquash = THREE.MathUtils.clamp(p.y / this.Rbot, 0.62, 1);
  }

  // jelly oscillators + spin (any state)
  stepSecondary(dt) {
    this.wobV += (-BALL.wobbleStiffness * this.wob - BALL.wobbleDamping * this.wobV) * dt;
    this.wob += this.wobV * dt;
    this.wob = THREE.MathUtils.clamp(this.wob, -0.14, 0.14);
    this.jigV += (-BALL.wobbleStiffness * 1.4 * this.jig - BALL.wobbleDamping * this.jigV) * dt;
    this.jig += this.jigV * dt;
    this.jig = THREE.MathUtils.clamp(this.jig, -0.1, 0.1);
    const w = this.omega.length();
    if (w > 1e-4) {
      _q.setFromAxisAngle(_ax.copy(this.omega).divideScalar(w), w * dt);
      this.spin.premultiply(_q);
    }
    this.glow *= Math.exp(-dt * 0.9);
  }

  // ── vertex deformation ──────────────────────────────────────
  deform() {
    const arr = this.geo.attributes.position.array;
    const b = this.base;
    const dr = this.dirs;
    const sy = this.floorSquash * (1 + this.wob);
    const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
    const sx = sxz * (1 + this.jig);
    const sz = sxz * (1 - this.jig);
    const dents = this.dents;
    let total = 0;
    for (const d of dents) total += d.d;
    const bulge = total * 0.42;
    const cosNear = Math.cos(THREE.MathUtils.degToRad(42));
    const cosWide = Math.cos(THREE.MathUtils.degToRad(72));
    let minY = Infinity;

    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3;
      const nx = dr[i3];
      const ny = dr[i3 + 1];
      const nz = dr[i3 + 2];
      let x = b[i3] * sx;
      let y = b[i3 + 1] * sy;
      let z = b[i3 + 2] * sz;
      let wmax = 0;
      for (let k = 0; k < dents.length; k++) {
        const u = dents[k].u;
        const c = nx * u.x + ny * u.y + nz * u.z;
        if (c <= cosWide) continue;
        const near = smooth(cosNear, 1, c);
        const wide = smooth(cosWide, 1, c);
        wmax = Math.max(wmax, wide);
        // flat press under the arm (along the press direction) …
        const m = dents[k].d * near;
        x -= u.x * m;
        y -= u.y * m;
        z -= u.z * m;
        // … and a soft radial give around it (keeps the silhouette round, no pinching)
        const g = dents[k].d * wide * 0.3;
        x -= nx * g;
        y -= ny * g;
        z -= nz * g;
      }
      if (bulge > 0) {
        const away = (1 - wmax) * (1 - wmax);
        // volume goes mostly sideways (between the arms), a little up/down
        const side = 0.3 + 0.7 * (1 - ny * ny);
        x += nx * bulge * away * side;
        y += ny * bulge * away * 0.45;
        z += nz * bulge * away * side;
      }
      arr[i3] = x;
      arr[i3 + 1] = y;
      arr[i3 + 2] = z;
      if (y < minY) minY = y;
    }
    // never sink into the floor
    const under = this.pos.y + minY;
    if (under < 0) {
      for (let i = 1; i < arr.length; i += 3) arr[i] -= under;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();

    const u = this.uniforms;
    _m4.makeRotationFromQuaternion(_q.copy(this.spin).invert());
    u.uRot.value.setFromMatrix4(_m4);
    u.uGlow.value = this.glow;
  }
}
