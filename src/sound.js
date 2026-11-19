// LUDUS sounds. Real recordings from Freesound, trimmed and levelled (licence checked on each page):
//   squeeze_1/2 short soft rubber '뽁' made for LUDUS (synthesized, ~0.1 s) — replaced the sticky slime recordings
//   slip_kiss   "Lip smack 2 (short)" by hollandm (CC0)           freesound.org/s/691905
//   slip_*      transients tamed and high end cut so they never sound torn
//   slip_pop    "EarlyFiles-TSR-Gummy Pop 3" by CAT-FOX_ALEX (CC0) freesound.org/s/853440
//   bounce_small "Bouncy ball bouncing on floor" by 89o_dev (CC0) freesound.org/s/869172
//   hit_1..4    "Bouncing Ball Recordings" by yfjesse (CC0)       freesound.org/s/734241
//   claw_a      "Putting On and Taking Off a Watch" by ross_sinc (CC0) freesound.org/s/444797  (clasp tick: claw closes)
//   claw_d      "Latch Clicks 2" by Nightflame (CC0)              freesound.org/s/397595
//   bgm         original 45 s background music made for LUDUS (synthesized summer pop; inspired by the mood only, no borrowed melody)
//   end_win (dreamy music box) / end_miss (boing bubbles): original endings made for LUDUS (synthesized)
//   claw_a/d are softened (high frequencies cut, pitched slightly down) so they don't hurt the ears.
// Browsers only allow sound after a tap, click or key press; the first one unlocks it (PC and phones alike).
// Levels matched to the other works (AGAPE as the reference): a short touch sound peaks around -34 LUFS,
// an ending around -26 LUFS, so visitors never have to touch the volume between the six works.
const LEVEL = {
  squeeze_1: 0.28, squeeze_2: 0.27, slip_kiss: 0.56, slip_pop: 0.6, bounce_small: 0.46,
  hit_1: 0.75, hit_2: 0.85, hit_3: 0.56, hit_4: 0.37, claw_a: 0.54, claw_d: 0.48,
  end_win: 0.19, end_miss: 0.26, bgm: 1,
};
const MAX_VOICES = 6;
const FX_TRIM = 0.5;   // all sound effects about 6 dB quieter (the music keeps its own level)
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
  // a real limiter at the end, so overlapping sounds never clip (no tearing peaks)
  comp.threshold.value = -16; comp.knee.value = 4; comp.ratio.value = 20; comp.attack.value = 0.001; comp.release.value = 0.1;
  out = ctx.createGain();
  out.gain.value = 0.85;
  out.connect(comp);
  // iPhone/iPad: Web Audio alone is muted by the silent switch. EROS gets through because its microphone
  // switches the phone into 'call' audio; without asking for the mic, the same effect comes from playing
  // the mix through an ordinary <audio> element (media playback ignores the silent switch).
  if (IOS && ctx.createMediaStreamDestination) {
    const dest = ctx.createMediaStreamDestination();
    comp.connect(dest);
    iosOut = new Audio(); iosOut.srcObject = dest.stream; iosOut.setAttribute('playsinline', '');
    iosComp = comp;
  } else comp.connect(ctx.destination);
  const base = import.meta.env.BASE_URL || '/';
  for (const n of Object.keys(LEVEL)) {
    fetch(`${base}sfx/${n}.mp3`).then((r) => r.arrayBuffer()).then(decode).then((b) => { bufs[n] = b; }).catch(() => {});
  }
}
// iPhone: Web Audio is muted when the ring/silent switch is on silent. Telling Safari this is media playback
// (audioSession, iOS 16.4+) and keeping a silent <audio> element playing (older iOS) lets the sounds through.
let mediaKick = null;
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let iosOut = null; let iosComp = null; let iosFallback = false;
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
function unlock() {
  setup();
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  // iOS wakes up only after something actually plays inside the gesture.
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
  if (!mediaKick) {
    mediaKick = new Audio(`${import.meta.env.BASE_URL || '/'}sfx/silence.mp3`);
    mediaKick.loop = true; mediaKick.setAttribute('playsinline', ''); mediaKick.preload = 'auto';
  }
  if (mediaKick.paused) mediaKick.play().catch(() => {});
  if (iosOut && iosOut.paused) {
    iosOut.play().catch(() => {
      // if the phone refuses the <audio> route, fall back to normal output (sound needs the switch off then)
      if (!iosFallback) { iosFallback = true; iosComp.connect(ctx.destination); }
    });
  }
}
// coming back to the tab (or after a phone call / lock screen) the audio may be suspended again
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  if (iosOut && iosOut.paused && !iosFallback) iosOut.play().catch(() => {});
});
for (const e of ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown']) window.addEventListener(e, unlock, { capture: true, passive: true });
setup();   // load the sounds (and the music) right away; they stay silent until the first tap unlocks audio

// gap: the same kind of sound never repeats faster than this (seconds).
function play(name, { gain = 1, rate = 1, lp = 18000, kind = name, gap = 0 } = {}) {
  if (!ctx || ctx.state !== 'running' || !bufs[name] || voices >= MAX_VOICES) return false;
  if (gap && ctx.currentTime - (last[kind] ?? -9) < gap) return false;
  last[kind] = ctx.currentTime;
  const s = ctx.createBufferSource();
  s.buffer = bufs[name];
  s.playbackRate.value = rate;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = ctx.createGain(); g.gain.value = gain * LEVEL[name] * FX_TRIM;
  s.connect(f).connect(g).connect(out);
  voices++;
  s.onended = () => { voices--; };
  s.start();
  return true;
}
const jitter = (k) => 1 + (Math.random() - 0.5) * k;

// background music: starts with the 45 s countdown, loops only if a round runs longer (second chance)
let bgm = null;
function bgmStop(fade = 1.0) {
  clearInterval(bgmTry);
  if (!bgm || !ctx) return;
  const { s, g } = bgm; bgm = null;
  g.gain.cancelScheduledValues(ctx.currentTime);
  g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
  try { s.stop(ctx.currentTime + fade + 0.1); } catch {}
}
let bgmTry = null;
function bgmStart() {
  if (!ctx) return;
  bgmStop(0.15);
  clearInterval(bgmTry);
  const t0 = performance.now();
  // On a phone the music file can take a few seconds to arrive, or audio may still be waking up:
  // keep trying, and when it does start, jump to where the countdown already is so they stay in step.
  const start = () => {
    if (!bufs.bgm || ctx.state !== 'running') return false;
    const at = ((performance.now() - t0) / 1000) % 45;
    const s = ctx.createBufferSource(); s.buffer = bufs.bgm; s.loop = true; s.loopEnd = 45;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, ctx.currentTime); g.gain.linearRampToValueAtTime(LEVEL.bgm, ctx.currentTime + 0.3);
    s.connect(g).connect(out); s.start(0, at); bgm = { s, g };
    return true;
  };
  if (!start()) {
    let n = 0;
    bgmTry = setInterval(() => { if (start() || ++n > 400) clearInterval(bgmTry); }, 100);
  }
}

let chain = 0; let chainAt = -9;   // repeated floor hits within a short time get smaller

export const sfx = {
  bgmStart,
  bgmStop,
  // k 0..1 = how hard the ball is squeezed: quiet and dull when light, louder and brighter when hard
  squeeze(k) {
    k = clamp(k);
    return play(pick(['squeeze_1', 'squeeze_2']), { kind: 'squeeze', gap: 0.14, gain: 0.25 + 0.75 * k, lp: 1800 + 14000 * k, rate: (1.06 - 0.1 * k) * jitter(0.05) });
  },
  // the ball springs out of the claw ('뽁') or slides out of it ('쪽')
  slip(type, k = 1) {
    k = clamp(k);
    play(type === 'pop' ? 'slip_pop' : 'slip_kiss', { kind: 'slip', gap: 0.12, gain: 0.35 + 0.65 * k, lp: 2500 + 2500 * k, rate: jitter(0.06) });
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
  // ending sounds, played once when the result text appears
  win() { play('end_win', { kind: 'ending', gap: 1 }); },
  miss() { play('end_miss', { kind: 'ending', gap: 1 }); },
  clawClose() { play('claw_a', { kind: 'clawCmd', gap: 0.08, rate: jitter(0.05) }); },
  clawOpen() { play('claw_d', { kind: 'clawCmd', gap: 0.08, rate: jitter(0.05) }); },
  // moving the claw left/right/up/down is silent (the servo whirr sounded torn)
  clawMove() {},

};
