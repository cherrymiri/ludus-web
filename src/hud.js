import * as THREE from 'three';
import { SUCCESS, MISS } from './config.js';

const _p = new THREE.Vector3();

// Success line (projected from world height) and the short result moment
// ("Okay, you win!" / "Missed me!") that hands over to the common lyrics ending.
// Everything is driven by the game mode + game time, so it always matches
// what happens in the scene and can never fire twice.
export class Hud {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.line = document.getElementById('success-line');
    this.win = document.getElementById('win');
    this.onEnding = null; // set by main: show the common lyrics ending
    this.clawTopTipWorldY = 0.7; // claw tips when backed off to the top (set from the scene)
    this.compact = false;
    this.ballTopWorldY = 0.2; // top of the resting ball (set from the scene)
    this.phase = 0; // 0 idle · 1 result fixed · 2 text shown · 3 ending
  }

  place() {
    const h = this.canvas.clientHeight;
    _p.set(0, SUCCESS.lineY, 0).project(this.camera);
    this.lineY = (1 - (_p.y * 0.5 + 0.5)) * h;
    this.line.style.top = `${this.lineY}px`;
    _p.set(0, this.ballTopWorldY, 0).project(this.camera);
    this.ballY = (1 - (_p.y * 0.5 + 0.5)) * h;
    this.placeResult();
  }

  // "Missed me!" sits in the empty band between the success line and the resting
  // ball; on short screens the claw backs off to the top and the text may rise
  // above the line. "Okay, you win!" sits just under the line.
  placeResult() {
    if (this.lineY === undefined) return;
    const H = this.canvas.clientHeight;
    const had = this.win.classList.contains('is-miss');
    if (!had) this.win.classList.add('is-miss'); // measure (no paint in between)
    const hMiss = this.win.offsetHeight;
    if (!had) this.win.classList.remove('is-miss');
    this.compact = hMiss + 36 > this.ballY - this.lineY;
    let y = Math.min((this.lineY + this.ballY) / 2, this.ballY - 18 - hMiss / 2);
    if (this.compact) {
      _p.set(0, this.clawTopTipWorldY, 0).project(this.camera);
      const tipY = (1 - (_p.y * 0.5 + 0.5)) * H;
      y = Math.max(y, Math.min(tipY + 14 + hMiss / 2, this.ballY - 8 - hMiss / 2));
    }
    this.win.style.setProperty('--miss-y', `${y}px`);
    if (!had) {
      const hWin = this.win.offsetHeight;
      this.win.style.setProperty('--win-y', `${Math.max(this.lineY + 16, Math.min(0.52 * H, H - hWin - 18))}px`);
    }
  }

  update(game) {
    if (game.resetting) return;
    const won = game.mode === 'won';
    if (!won && game.mode !== 'missed') return;
    const C = won ? SUCCESS : MISS;
    if (this.phase < 1) {
      this.phase = 1;
      if (won) this.line.classList.add('is-success', 'is-flash');
      else {
        this.win.classList.add('is-miss');
        this.placeResult();
      }
    }
    if (this.phase < 2 && game.endT >= C.textDelay) {
      this.phase = 2;
      this.win.classList.add('is-on');
    }
    if (this.phase < 3 && game.endT >= C.endingDelay) {
      this.phase = 3;
      this.onEnding?.();
    }
  }

  // back to the playing look (called when the scene is reset)
  clear() {
    this.phase = 0;
    this.win.classList.remove('is-on', 'is-miss');
    this.line.classList.remove('is-success', 'is-flash');
  }
}
