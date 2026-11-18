// LUDUS sounds. Real recordings from Freesound, trimmed and levelled (licence checked on each page):
//   squeeze_1   "Slime 27.wav" by Archos (CC0)                    freesound.org/s/433840  (pitched up)
//   squeeze_2   "Wet Squishy sound" by ricexzeeb (CC0)            freesound.org/s/151184  (pitched up)
//   slip_kiss   "Lip smack 2 (short)" by hollandm (CC0)           freesound.org/s/691905
//   slip_pop    "EarlyFiles-TSR-Gummy Pop 3" by CAT-FOX_ALEX (CC0) freesound.org/s/853440
//   bounce_small "Bouncy ball bouncing on floor" by 89o_dev (CC0) freesound.org/s/869172
//   hit_1..4    "Bouncing Ball Recordings" by yfjesse (CC0)       freesound.org/s/734241
//   claw_a/d    "Latch Clicks 2" by Nightflame (CC0)              freesound.org/s/397595
//   claw_b      "Small servo (arduino)" by gpag1 (CC0)            freesound.org/s/520514
// Browsers only allow sound after a tap, click or key press; the first one unlocks it (PC and phones alike).
const LEVEL = {
  squeeze_1: 0.94, squeeze_2: 1, slip_kiss: 0.9, slip_pop: 1, bounce_small: 0.72,
  hit_1: 0.97, hit_2: 0.88, hit_3: 0.72, hit_4: 0.47, claw_a: 0.8, claw_d: 1, claw_b: 0.3,
};
const MAX_VOICES = 6;
const clamp = (v) => Math.max(0, Math.min(1, v));
const pick = (list) => list[Math.floor(Math.random() * list.length)];

let ctx = null; let out = null; let voices = 0;
const bufs = {};
const last = {};

function decode(data) {
  return new Promise((ok, fail) => {
    const p = ctx.decodeAudioData(data, ok, fail);
    if (p && p.then) p.then(ok, fail);
  });
}
function setup() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  out = ctx.createGain();
  out.gain.value = 0.85;
  out.connect(comp).connect(ctx.destination);
  const base = import.meta.env.BASE_URL || '/';
  for (const n of Object.keys(LEVEL)) {
    fetch(`${base}sfx/${n}.mp3`).then((r) => r.arrayBuffer()).then(decode).then((b) => { bufs[n] = b; }).catch(() => {});
  }
}
function unlock() {
  setup();
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  // iOS wakes up only after something actually plays inside the gesture.
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
}
for (const e of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(e, unlock, { capture: true, passive: true });

// gap: the same kind of sound never repeats faster than this (seconds).
function play(name, { gain = 1, rate = 1, lp = 18000, kind = name, gap = 0 } = {}) {
  if (!ctx || ctx.state !== 'running' || !bufs[name] || voices >= MAX_VOICES) return false;
  if (gap && ctx.currentTime - (last[kind] ?? -9) < gap) return false;
  last[kind] = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = bufs[name];
  s.playbackRate.value = rate;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ctx.createGain(); g.gain.value = gain * LEVEL[name];
  s.connect(f).connect(g).connect(out);
  voices++;
  s.onended = () => { voices--; };
  s.start();
  return true;
}
const jitter = (k) => 1 + (Math.random() - 0.5) * k;

let chain = 0; let chainAt = -9;   // repeated floor hits within a short time get smaller

export const sfx = {
  // k 0..1 = how hard the ball is squeezed: quiet and dull when light, louder and brighter when hard
  squeeze(k) {
    k = clamp(k);
    return play(pick(['squeeze_1', 'squeeze_2']), { kind: 'squeeze', gap: 0.14, gain: 0.25 + 0.75 * k, lp: 1800 + 14000 * k, rate: (1.06 - 0.1 * k) * jitter(0.05) });
  },
  // the ball springs out of the claw ('뽁') or slides out of it ('쪽')
  slip(type, k = 1) {
    k = clamp(k);
    play(type === 'pop' ? 'slip_pop' : 'slip_kiss', { kind: 'slip', gap: 0.12, gain: 0.35 + 0.65 * k, lp: 3000 + 13000 * k, rate: jitter(0.06) });
  },
  // speed: how fast the ball hits the floor (m/s)
  bounce(speed) {
    if (!ctx) return;
    const now = ctx.currentTime;
    chain = now - chainAt < 1.2 ? chain + 1 : 0;
    chainAt = now;
    const k = clamp((speed - 0.25) / 2.0) * Math.pow(0.82, chain);
    if (k < 0.02) return;
    // hard hits use the first bounces of the real recording, soft ones its later, smaller bounces
    const real = k > 0.6 ? 'hit_1' : k > 0.35 ? 'hit_2' : k > 0.15 ? 'hit_3' : 'hit_4';
    const n = Math.random() < 0.4 ? 'bounce_small' : real;
    play(n, { kind: 'bounce', gap: 0.05, gain: 0.12 + 0.88 * k, lp: 2500 + 15000 * k, rate: (1 + (1 - k) * 0.1) * jitter(0.04) });
  },
  clawClose() { play('claw_a', { kind: 'clawCmd', gap: 0.08, rate: jitter(0.05) }); },
  clawOpen() { play('claw_d', { kind: 'clawCmd', gap: 0.08, rate: jitter(0.05) }); },
  // the claw starts moving; speed in m/s
  clawMove(speed) {
    const k = clamp(speed / 1.1);
    play('claw_b', { kind: 'clawMove', gap: 0.7, gain: 0.4 + 0.6 * k, rate: (0.95 + 0.15 * k) * jitter(0.04) });
  },
};
