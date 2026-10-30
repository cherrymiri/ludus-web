import * as THREE from 'three';
import { SUCCESS } from './config.js';

const _p = new THREE.Vector3();

// Success line (projected from world height) and the win screen.
// Everything is driven by the game state + game time, so it always matches
// what happens in the scene and can never fire twice.
export class Hud {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.line = document.getElementById('success-line');
    this.win = document.getElementById('win');
    this.retry = document.getElementById('retry');
    this.phase = 0; // 0 idle · 1 line lit · 2 text shown · 3 button shown
  }

  place() {
    _p.set(0, SUCCESS.lineY, 0).project(this.camera);
    const y = (1 - (_p.y * 0.5 + 0.5)) * this.canvas.clientHeight;
    this.line.style.top = `${y}px`;
  }

  update(game) {
    const on = game.state === 'success' && !game.resetting;
    if (!on) return;
    if (this.phase < 1) {
      this.phase = 1;
      this.line.classList.add('is-success', 'is-flash');
    }
    if (this.phase < 2 && game.t >= SUCCESS.textDelay) {
      this.phase = 2;
      this.win.classList.remove('is-leaving');
      this.win.classList.add('is-on');
    }
    if (this.phase < 3 && game.t >= SUCCESS.buttonDelay) {
      this.phase = 3;
      this.win.classList.add('has-button');
      this.retry.tabIndex = 0;
    }
  }

  // fade the win screen out (start of "다시 잡아볼래?")
  leave() {
    this.win.classList.add('is-leaving');
    this.retry.tabIndex = -1;
    this.retry.blur();
  }

  // back to the idle look (called after the scene has been reset)
  clear() {
    this.phase = 0;
    this.win.classList.remove('is-on', 'has-button', 'is-leaving');
    this.line.classList.remove('is-success', 'is-flash');
  }
}
