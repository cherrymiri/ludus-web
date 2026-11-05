import * as THREE from 'three';
import { SUCCESS, MISS } from './config.js';

const _p = new THREE.Vector3();

// Success line (projected from world height), the result screen
// ("Okay, you win!" / "Missed me!") and the start button position.
// Everything is driven by the game mode + game time, so it always matches
// what happens in the scene and can never fire twice.
export class Hud {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.line = document.getElementById('success-line');
    this.win = document.getElementById('win');
    this.retry = document.getElementById('retry');
    this.start = document.getElementById('start');
    this.startWorldY = 0.3; // set from the scene: the empty gap between claw and ball
    this.ballTopWorldY = 0.2; // top of the resting ball (set from the scene)
    this.phase = 0; // 0 idle · 1 line lit / result fixed · 2 text shown · 3 button shown
  }

  place() {
    const h = this.canvas.clientHeight;
    _p.set(0, SUCCESS.lineY, 0).project(this.camera);
    this.line.style.top = `${(1 - (_p.y * 0.5 + 0.5)) * h}px`;
    _p.set(0, this.startWorldY, 0).project(this.camera);
    this.start.style.setProperty('--start-y', `${(1 - (_p.y * 0.5 + 0.5)) * h}px`);
    // "Missed me!" sits in the empty band between the success line and the resting ball
    const lineY = parseFloat(this.line.style.top);
    _p.set(0, this.ballTopWorldY, 0).project(this.camera);
    const ballY = (1 - (_p.y * 0.5 + 0.5)) * h;
    this.win.style.setProperty('--miss-y', `${(lineY + ballY) / 2}px`);
  }

  update(game) {
    if (game.resetting) return;
    if (game.mode === 'won') {
      if (this.phase < 1) {
        this.phase = 1;
        this.line.classList.add('is-success', 'is-flash');
      }
      if (this.phase < 2 && game.endT >= SUCCESS.textDelay) this.showText();
      if (this.phase < 3 && game.endT >= SUCCESS.buttonDelay) this.showButton();
    } else if (game.mode === 'missed') {
      if (this.phase < 1) {
        this.phase = 1;
        this.win.classList.add('is-miss');
      }
      if (this.phase < 2 && game.endT >= MISS.textDelay) this.showText();
      if (this.phase < 3 && game.endT >= MISS.buttonDelay) this.showButton();
    }
  }

  showText() {
    this.phase = 2;
    this.win.classList.remove('is-leaving');
    this.win.classList.add('is-on');
  }

  showButton() {
    this.phase = 3;
    this.win.classList.add('has-button');
    this.retry.tabIndex = 0;
  }

  // fade the result screen out (start of "다시 잡아볼래?")
  leave() {
    this.win.classList.add('is-leaving');
    this.retry.tabIndex = -1;
    this.retry.blur();
  }

  // back to the idle look (called after the scene has been reset)
  clear() {
    this.phase = 0;
    this.win.classList.remove('is-on', 'has-button', 'is-leaving', 'is-miss');
    this.line.classList.remove('is-success', 'is-flash');
  }
}
