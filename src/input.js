import * as THREE from 'three';
import { CLAW } from './config.js';

// Mouse only: move → claw X, wheel → claw Y, left click → toggle open/close.
export function bindInput({ canvas, camera, claw, game }) {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) claw.target.x = THREE.MathUtils.clamp(hit.x, -CLAW.xLimit, CLAW.xLimit);
  };

  const onWheel = (e) => {
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16; // lines
    else if (e.deltaMode === 2) d *= 400; // pages
    const step = THREE.MathUtils.clamp(d * CLAW.wheelStep, -CLAW.wheelMaxPerEvent, CLAW.wheelMaxPerEvent);
    // scroll down (positive delta) lowers the claw
    claw.target.y = Math.min(CLAW.yMax, Math.max(claw.target.y, claw.pos.y - 0.03) - step);
  };

  const onDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    game.toggle();
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
