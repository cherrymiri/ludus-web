import * as THREE from 'three';
import { SUCCESS, MISS } from './config.js';
import { sfx } from './sound.js';

const _p = new THREE.Vector3();

// Success line (projected from world height) and the result screen:
// "Okay, you win!" / "Missed me!" → lyrics + credit → "다시 잡아볼래?".
// Everything is driven by the game mode + game time, so it always matches
// what happens in the scene and can never fire twice.
export class Hud {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.line = document.getElementById('success-line');
    this.win = document.getElementById('win');
    this.retry = document.getElementById('retry');
    // soft blurred copy of the lyrics behind them, for Apple Music-like depth
    const lyr = this.win.querySelector('.verse-lyrics');
    if (lyr && !this.win.querySelector('.verse-glow')) {
      const glow = lyr.cloneNode(true);
      glow.className = 'verse-glow';
      glow.setAttribute('aria-hidden', 'true');
      lyr.before(glow);
    }
    this.clawTopTipWorldY = 0.7; // claw tips when backed off to the top (set from the scene)
    this.compact = false;
    this.ballTopWorldY = 0.2; // top of the resting ball (set from the scene)
    this.phase = 0; // 0 idle · 1 result fixed · 2 text shown · 3 button shown
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
    y = Math.min(Math.max(y, hMiss / 2 + 12), H - hMiss / 2 - 12); // always fully on screen
    this.win.style.setProperty('--miss-y', `${y}px`);
    if (!had) {
      const hWin = this.win.offsetHeight;
      // centre the whole group (text, lyrics, button) in the open space under the line
      let top = (this.lineY + H) / 2 - hWin / 2;
      // phones held upright: "Okay, you win!" sits just under the success line, clear of its glow
      if (H > this.win.ownerDocument.documentElement.clientWidth) {
        top = Math.min(Math.max(y - hWin / 2, this.lineY + 28), H - hWin - 12);
        this.win.style.setProperty('--win-y', `${top}px`);
        return;
      }
      this.win.style.setProperty('--win-y', `${Math.max(12, Math.min(Math.max(this.lineY + 16, top), H - hWin - 18))}px`);
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
      won ? sfx.win() : sfx.miss();
    }
    if (this.phase < 3 && game.endT >= C.buttonDelay) {
      this.phase = 3;
      this.win.classList.add('has-button');
      this.retry.tabIndex = 0;
    }
  }

  // fade the result screen out (start of "다시 잡아볼래?")
  leave() {
    this.win.classList.add('is-leaving');
    this.retry.tabIndex = -1;
    this.retry.blur();
  }

  // back to the playing look (called when the scene is reset)
  clear() {
    this.phase = 0;
    this.win.classList.remove('is-on', 'is-miss', 'has-button', 'is-leaving');
    this.line.classList.remove('is-success', 'is-flash');
  }
}
