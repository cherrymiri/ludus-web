import { TIMER } from './config.js';

// 60-second countdown on the real clock (ms timestamps passed in by the caller).
// States: idle (01:00, not running) · play · won (frozen) · missed (00:00).
export class Timer {
  constructor(el) {
    this.el = el;
    this.digits = el.querySelector('.timer-digits');
    this.reset();
  }

  reset() {
    this.running = false;
    this.deadline = 0;
    this.frozen = TIMER.duration;
    this.text = '';
    this.level = null;
    this.setState('idle');
    this.render(0);
  }

  start(now) {
    this.running = true;
    this.deadline = now + TIMER.duration * 1000;
    this.setState('play');
  }

  remaining(now) {
    return this.running ? Math.max(0, (this.deadline - now) / 1000) : this.frozen;
  }

  // stop at a given moment: 'won' keeps the time it was reached, 'missed' shows 00:00
  stop(now, state) {
    if (!this.running) return;
    // a buzzer-beater win still reads 00:01, never the time-out 00:00
    this.frozen = state === 'missed' ? 0 : Math.max(0.001, this.remaining(now));
    this.running = false;
    this.setState(state);
    this.render(now);
  }

  setState(s) {
    this.state = s;
    this.el.dataset.state = s;
  }

  render(now) {
    const rem = this.remaining(now);
    const s = Math.ceil(rem);
    const text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (text !== this.text) {
      this.text = text;
      this.digits.textContent = text;
    }
    // pulse synced to the second ticks
    let level = 'calm';
    let p = 0;
    if (this.running && s > 0) {
      const since = s - rem; // 0 right after the number changes
      if (s <= TIMER.urgentFrom) {
        level = 'urgent';
        p = Math.exp(-((since * 2) % 1) * 4.5);
      } else if (s <= TIMER.pulseFrom) {
        level = 'pulse';
        p = 0.6 * Math.exp(-since * 3.2);
      }
    }
    if (level !== this.level) {
      this.level = level;
      this.el.dataset.level = level;
    }
    this.el.style.setProperty('--p', p.toFixed(3));
  }
}
