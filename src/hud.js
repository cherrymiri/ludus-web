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
    this.clawTopTipWorldY = 0.7; // claw tips when backed off to the top (set from the scene)
    this.compact = false;
    this.startWorldY = 0.3; // set from the scene: the empty gap between claw and ball
    this.ballTopWorldY = 0.2; // top of the resting ball (set from the scene)
    // lyrics are filled in by hand in index.html; without them, no lyrics or credit
    const lines = [...this.win.querySelectorAll('.lyric-line')];
    this.win.classList.toggle('no-lyrics', !lines.length || lines.some((l) => !l.textContent.trim()));
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
    this.ballY = (1 - (_p.y * 0.5 + 0.5)) * h;
    this.lineY = lineY;
    this.placeMiss();
  }

  // "Missed me!" + lyrics sit in the empty band between the success line and the
  // resting ball; if the band is too short the block keeps clear of the ball
  // and grows upward instead.
  placeMiss() {
    if (this.lineY === undefined) return;
    // measure the ending block (adding the class for a moment causes no paint)
    const had = this.win.classList.contains('is-miss');
    if (!had) this.win.classList.add('is-miss');
    const hBlock = this.win.offsetHeight;
    if (!had) this.win.classList.remove('is-miss');
    // compact: the block does not fit between the line and the ball, so the
    // claw backs off to the top and the block may rise above the line
    this.compact = hBlock + 36 > this.ballY - this.lineY;
    const mid = (this.lineY + this.ballY) / 2;
    let y = Math.min(mid, this.ballY - 18 - hBlock / 2);
    if (this.compact) {
      _p.set(0, this.clawTopTipWorldY ?? 0.7, 0).project(this.camera);
      const tipY = (1 - (_p.y * 0.5 + 0.5)) * this.canvas.clientHeight;
      y = Math.max(y, Math.min(tipY + 14 + hBlock / 2, this.ballY - 8 - hBlock / 2));
    }
    this.win.style.setProperty('--miss-y', `${y}px`);
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
        this.placeMiss();
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
