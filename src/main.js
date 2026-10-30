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
import { CLAW } from './config.js';
import './style.css';

const container = document.getElementById('stage');
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

    // start: claw hovering above the ball
    claw.reset(CLAW.startY);

    // "다시 잡아볼래?" — fade out, reset the scene in place (no reload, no re-download), fade in
    const retry = document.getElementById('retry');
    let resetTimer = 0;
    retry.addEventListener('click', () => {
      if (game.state !== 'success' || game.resetting) return;
      game.resetting = true;
      hud.leave();
      document.body.classList.add('is-resetting');
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        game.reset();
        hud.clear();
        touch.sync();
        document.body.classList.remove('is-resetting');
        game.resetting = false;
      }, 420);
    });

    const onResize = () => {
      resize();
      hud.place();
    };
    window.addEventListener('resize', onResize);
    onResize();

    const clock = new THREE.Clock();
    const coreU = ball.uniforms;
    let paused = false;
    const frame = (dt, render = true) => {
      game.update(dt);
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
      force: (o) => (game.forced = o || null),
      pause: (v = true) => (paused = v),
      step: (frames = 1, dt = 1 / 60, render = true) => {
        for (let i = 0; i < frames; i++) frame(dt, render && i === frames - 1);
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
