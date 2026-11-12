// Fullscreen API wrapper (Chrome/Edge/Firefox + Safari prefix).
// Never throws: unsupported or refused requests simply resolve to false.
const root = () => document.documentElement;

export const fsSupported = () =>
  !!(document.fullscreenEnabled || document.webkitFullscreenEnabled) &&
  !!(root().requestFullscreen || root().webkitRequestFullscreen);

export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

// Must be called directly inside a click handler (browsers refuse it after an await).
export function enterFullscreen() {
  try {
    if (!fsSupported() || isFullscreen()) return Promise.resolve(isFullscreen());
    const el = root();
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : el.webkitRequestFullscreen();
    return Promise.resolve(p).then(
      () => true,
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
}

export function onFullscreenChange(cb) {
  document.addEventListener('fullscreenchange', cb);
  document.addEventListener('webkitfullscreenchange', cb);
}
