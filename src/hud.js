import * as THREE from 'three';
import { SUCCESS } from './config.js';

const _p = new THREE.Vector3();

// Success line (projected from world height) + restrained success feedback,
// driven by the game state so it always matches what happens on screen.
export class Hud {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.line = document.getElementById('success-line');
    this.flash = document.getElementById('success-text');
    this.on = false;
  }

  place() {
    _p.set(0, SUCCESS.lineY, 0).project(this.camera);
    const y = (1 - (_p.y * 0.5 + 0.5)) * this.canvas.clientHeight;
    this.line.style.top = `${y}px`;
    this.flash.style.top = `${y}px`;
  }

  update(state) {
    const on = state === 'success';
    if (on === this.on) return;
    this.on = on;
    this.line.classList.toggle('is-success', on);
    this.flash.classList.toggle('is-visible', on);
  }

  success() {}
}
