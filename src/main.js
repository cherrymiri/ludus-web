import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createStage, createFloorGlow } from './stage.js';
import { applyClawMaterials, createOrbSkin, createOrbBody } from './materials.js';
import { Claw } from './claw.js';
import { Ball } from './ball.js';
import { Game } from './game.js';
import { Hud } from './hud.js';
import { bindInput } from './input.js';
import { bindTouch } from './touch.js';
import { Timer } from './timer.js';
import { CLAW } from './config.js';
import { enterFullscreen, fsSupported, isFullscreen, onFullscreenChange } from './fullscreen.js';
import './style.css';

const container = document.getElementById('stage');

// ── opening & fullscreen (bound right away, before the model has loaded) ──
const opening = document.getElementById('opening');
const fsBtn = document.getElementById('fsbtn');
const skipOpening = new URLSearchParams(location.search).has('skip'); // dev / tests
let startPlay = null; // set once the scene is ready
let startWanted = false;
const syncFsButton = () => {
  fsBtn.hidden = !fsSupported() || isFullscreen() || document.body.classList.contains('phase-opening');
};
onFullscreenChange(syncFsButton);
fsBtn.addEventListener('click', () => enterFullscreen());
const closeOpening = () => {
  document.body.classList.remove('phase-opening');
  opening.classList.add('closing');
  setTimeout(() => (opening.hidden = true), 900);
  syncFsButton();
};
document.getElementById('op-start').addEventListener('click', (e) => {
  e.currentTarget.disabled = true;
  enterFullscreen(); // inside the click: Chrome hides tabs and address bar
  closeOpening();
  // the scene fades in, then the countdown starts
  setTimeout(() => (startPlay ? startPlay() : (startWanted = true)), 1100);
});
if (skipOpening) {
  opening.hidden = true;
  document.body.classList.remove('phase-opening');
}
syncFsButton();
const { renderer, scene, camera, resize } = createStage(container);

const loader = new GLTFLoader();
const onLoaded = (gltf) => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    const clawNode = root.getObjectByName('CLAW');
    const ballMesh = root.getObjectByName('Ball');
    scene.attach(clawNode);
    scene.attach(ballMesh);

    applyClawMaterials(clawNode);
    const claw = new Claw(clawNode);
    const ball = new Ball(ballMesh, createOrbBody, createOrbSkin());

    const glow = createFloorGlow();
    scene.add(glow);

    const hud = new Hud(camera, renderer.domElement);
    const game = new Game({ claw, ball, hud });
    bindInput({ canvas: renderer.domElement, camera, claw, game });
    const touch = bindTouch({ canvas: renderer.domElement, camera, claw, game });

    const timer = new Timer(document.getElementById('timer'));

    // real clock for the countdown (tests can swap in a virtual one, see __LUDUS)
    let virtualNow = null;
    const nowMs = () => virtualNow ?? performance.now();
    let lastNow = nowMs();

    // waiting state: claw hovering above the ball, timer full, controls locked
    game.reset();
    hud.startWorldY = (claw.lowestTipY() + ball.top()) / 2;
    hud.ballTopWorldY = ball.top();
    hud.clawTopTipWorldY = CLAW.yMax - 0.02 + claw.lowestOffset;

    const syncMode = () => {
      const m = game.mode;
      if (document.body.dataset.mode !== m) document.body.dataset.mode = m;
    };
    syncMode();

    // the countdown starts when the opening closes (and again after 다시 체험하기)
    startPlay = () => {
      if (!game.start()) return false;
      const now = nowMs();
      timer.start(now);
      lastNow = now;
      syncMode();
      return true;
    };
    if (startWanted) startPlay();

    // "다시 잡아볼래?" — fade the result out, reset the scene in place (no reload,
    // no opening, fullscreen kept) and start a fresh round.
    const retry = document.getElementById('retry');
    let resetTimers = [];
    retry.addEventListener('click', () => {
      if ((game.mode !== 'won' && game.mode !== 'missed') || game.resetting) return;
      if (fsSupported() && !isFullscreen()) enterFullscreen(); // stay immersive
      // a time-out earns a second chance; after any win it is back to normal difficulty
      const secondChance = game.mode === 'missed' && !game.assist;
      game.resetting = true;
      hud.leave();
      document.body.classList.add('is-resetting');
      resetTimers.forEach(clearTimeout);
      resetTimers = [
        setTimeout(() => {
          game.reset();
          game.assist = secondChance;
          timer.reset();
          hud.clear();
          touch.sync();
          syncMode();
          document.body.classList.remove('is-resetting');
        }, 420),
        setTimeout(() => {
          game.resetting = false;
          startPlay();
        }, 900),
      ];
    });

    // Keep the 3D view matched to the real screen size. Mobile browsers (iOS Safari
    // especially) can skip or delay 'resize' when the toolbar collapses or the phone
    // rotates, which would leave the scene stretched — so we also check every frame.
    let lastW = 0;
    let lastH = 0;
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      lastW = w;
      lastH = h;
      resize();
      hud.place();
      game.missRetractTop = hud.compact;
    };
    const checkSize = () => {
      if (container.clientWidth !== lastW || container.clientHeight !== lastH) onResize();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 250));
    window.visualViewport?.addEventListener('resize', onResize);
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(container);
    onResize();

    const clock = new THREE.Clock();
    const coreU = ball.uniforms;
    let paused = false;
    const frame = (dt, render = true) => {
      checkSize();
      const now = nowMs();
      game.timeLeft = game.mode === 'play' && timer.running ? timer.remaining(now) : Infinity;
      if (game.mode === 'play' && timer.running && now >= timer.deadline && !game.assist) {
        // Time ran out during this frame: first simulate up to the deadline, so a
        // success reached before it still counts; then the result is fixed.
        const pre = THREE.MathUtils.clamp((timer.deadline - lastNow) / 1000, 0, dt);
        if (pre > 0) game.update(pre);
        if (game.mode === 'won') timer.stop(lastNow + pre * 1000, 'won');
        else {
          game.timeout();
          timer.stop(timer.deadline, 'missed');
        }
        if (dt - pre > 0) game.update(dt - pre);
      } else {
        game.update(dt);
        if (game.mode === 'won') timer.stop(now, 'won');
      }
      lastNow = now;
      timer.render(now);
      syncMode();
      hud.update(game);
      touch.sync();
      coreU.uTime.value += dt;
      // floor glow follows the ball and fades as it rises
      const h = Math.max(0, ball.bottom());
      glow.position.set(ball.pos.x, 0.0005, ball.pos.z);
      glow.material.opacity = 0.42 * Math.exp(-h * 7);
      glow.scale.setScalar(1 + h * 1.5);
      if (render) renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 1 / 30);
      if (!paused) frame(dt);
    });

    // test / tuning hook (harmless in production): force an outcome, or step frames deterministically
    window.__LUDUS = {
      game,
      claw,
      ball,
      camera,
      timer,
      hud,
      startPlay: () => startPlay(),
      force: (o) => (game.forced = o || null),
      // paused: frames only advance through step(), on a virtual clock
      pause: (v = true) => {
        paused = v;
        virtualNow = v ? nowMs() : null;
        lastNow = nowMs();
      },
      step: (frames = 1, dt = 1 / 60, render = true) => {
        for (let i = 0; i < frames; i++) {
          if (virtualNow !== null) virtualNow += dt * 1000;
          frame(dt, render && i === frames - 1);
        }
      },
      // jump the running countdown to a given number of seconds left
      setRemaining: (s) => {
        if (timer.running) timer.deadline = nowMs() + s * 1000;
      },
    };
    document.body.classList.add('is-ready');
};
const onError = (err) => {
  console.error(err);
  document.getElementById('loading').textContent = 'MODEL FAILED TO LOAD';
};

// The deployed site loads public/models/ludus.glb. A single-file preview build may
// embed the same GLB as base64 in window.__LUDUS_GLB__ instead.
if (window.__LUDUS_GLB__) {
  const bin = Uint8Array.from(atob(window.__LUDUS_GLB__), (ch) => ch.charCodeAt(0));
  loader.parse(bin.buffer, '', onLoaded, onError);
} else {
  loader.load(`${import.meta.env.BASE_URL}models/ludus.glb`, onLoaded, undefined, onError);
}
