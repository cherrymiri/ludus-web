import * as THREE from 'three';
import { CLAW } from './config.js';

// Touch (phones/tablets): drag anywhere → claw X, right slider → claw Y,
// grab button → toggle open/close. Uses the same claw targets and game logic as the mouse.
export function bindTouch({ canvas, camera, claw, game }) {
  const lift = document.getElementById('lift');
  const grab = document.getElementById('grab');
  const label = grab.querySelector('.grab-label');

  const markTouch = () => document.body.classList.add('is-touch');

  // world metres per CSS pixel on the claw's plane (z = 0)
  const worldPerPx = () => {
    const dist = camera.position.z;
    const h = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return h / canvas.clientHeight;
  };

  // ── horizontal drag on the scene ─────────────────────────
  let dragId = null;
  let startX = 0;
  let startTarget = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    markTouch();
    if (game.locked || dragId !== null) return;
    dragId = e.pointerId;
    startX = e.clientX;
    startTarget = claw.target.x;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId || game.locked) return;
    const dx = (e.clientX - startX) * worldPerPx() * CLAW.touchDragGain;
    claw.target.x = THREE.MathUtils.clamp(startTarget + dx, -CLAW.xLimit, CLAW.xLimit);
  });
  const endDrag = (e) => {
    if (e.pointerId === dragId) dragId = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // ── vertical slider ──────────────────────────────────────
  const yLow = () => CLAW.yMinSlider;
  const toValue = (y) => THREE.MathUtils.clamp((y - yLow()) / (CLAW.yMax - yLow()), 0, 1);
  const fromValue = (v) => yLow() + v * (CLAW.yMax - yLow());
  let sliding = null;
  const setFromPointer = (e) => {
    const r = lift.getBoundingClientRect();
    const v = THREE.MathUtils.clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    claw.target.y = fromValue(v);
    show(v);
  };
  lift.addEventListener('pointerdown', (e) => {
    markTouch();
    if (game.locked) return;
    e.preventDefault();
    sliding = e.pointerId;
    lift.setPointerCapture?.(e.pointerId);
    lift.classList.add('is-active');
    setFromPointer(e);
  });
  lift.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sliding || game.locked) return;
    setFromPointer(e);
  });
  const endSlide = (e) => {
    if (e.pointerId !== sliding) return;
    sliding = null;
    lift.classList.remove('is-active');
  };
  lift.addEventListener('pointerup', endSlide);
  lift.addEventListener('pointercancel', endSlide);
  lift.addEventListener('keydown', (e) => {
    if (game.locked) return;
    const step = e.key === 'ArrowUp' ? 0.05 : e.key === 'ArrowDown' ? -0.05 : 0;
    if (!step) return;
    e.preventDefault();
    claw.target.y = fromValue(toValue(claw.target.y) + step);
  });
  const show = (v) => {
    lift.style.setProperty('--v', v.toFixed(3));
    lift.setAttribute('aria-valuenow', Math.round(v * 100));
  };

  // ── grab button ──────────────────────────────────────────
  grab.addEventListener('click', () => {
    if (game.locked) return;
    game.toggle();
  });

  // ── no page zoom / scroll while playing ──────────────────
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 || e.target === canvas || lift.contains(e.target)) e.preventDefault();
    },
    { passive: false }
  );
  let lastTap = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = performance.now();
      if (now - lastTap < 320 && !e.target.closest('button')) e.preventDefault(); // no double-tap zoom
      lastTap = now;
    },
    { passive: false }
  );

  // called every frame: keep the controls in step with the real claw
  let lastClosed = null;
  let lastLocked = null;
  return {
    sync() {
      if (sliding === null) show(toValue(claw.pos.y));
      if (claw.closed !== lastClosed) {
        lastClosed = claw.closed;
        grab.classList.toggle('is-closed', claw.closed);
        grab.setAttribute('aria-pressed', String(claw.closed));
        label.textContent = claw.closed ? '놓기' : '잡기';
      }
      const locked = game.locked;
      if (locked !== lastLocked) {
        lastLocked = locked;
        grab.disabled = locked;
        lift.classList.toggle('is-locked', locked);
        if (locked) {
          dragId = null;
          sliding = null;
          lift.classList.remove('is-active');
        }
      }
    },
  };
}
