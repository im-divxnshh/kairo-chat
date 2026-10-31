const path = require('node:path');

const identity = {
  name: 'Kairo',
  appId: 'com.kairo.chat',
  icon: path.join(__dirname, '../assets/branding/icon.png'),
};

function applyIdentity(app, platform = process.platform) {
  const existingData = app.getPath('userData');
  app.setName?.(identity.name);
  // Branding must preserve existing sessions, cached conversations and preferences.
  app.setPath?.('userData', existingData);
  if (platform === 'win32') app.setAppUserModelId?.(identity.appId);
}

function createLauncher({ app, BrowserWindow, nativeImage, systemPreferences,
  platform = process.platform, settings = () => ({}), busy = () => false,
  clock = { setInterval, clearInterval } }) {
  let timer = null, frame = 0, disposed = false, loaded = false, painted = false;
  let base, frames;
  const windows = () => BrowserWindow.getAllWindows().filter(window => !window.isDestroyed());

  function enabled() {
    const current = settings();
    if (current.animatedLauncher === false || current.reducedMotion) return false;
    try {
      if (systemPreferences?.getAnimationSettings?.().prefersReducedMotion) return false;
    } catch { /* Some platforms do not expose animation preferences. */ }
    return true;
  }

  function load() {
    if (loaded) return !!frames;
    loaded = true;
    if (!nativeImage || !['darwin', 'win32'].includes(platform)) return false;
    try {
      base = nativeImage.createFromPath(identity.icon);
      if (base.isEmpty()) return false;
      const images = Array.from({ length: 32 }, (_, index) => nativeImage.createFromPath(
        path.join(__dirname, '../assets/branding/frames', `frame-${String(index).padStart(2, '0')}.png`)));
      if (images.some(image => image.isEmpty())) return false;
      frames = images;
      return true;
    } catch { return false; }
  }

  function paint(image, animated) {
    let success = false;
    if (platform === 'darwin') {
      try {
        if (app.dock) { app.dock.setIcon(image); success = true; }
      } catch { /* Dock availability must not interrupt a chat or shutdown. */ }
    } else if (platform === 'win32') {
      for (const window of windows()) {
        try {
          window.setIcon(image);
          // Windows controls pinned shortcuts; the running overlay can animate.
          window.setOverlayIcon(animated ? image.resize({ width: 16, height: 16 }) : null,
            animated ? busy() ? 'Kairo is working' : 'Kairo is running' : '');
          success = true;
        } catch { /* A window may close while its native icon is being updated. */ }
      }
    }
    return success;
  }

  function stop() {
    if (timer !== null) { clock.clearInterval(timer); timer = null; }
    if (painted && base) paint(base, false);
    painted = false;
  }

  function tick() {
    if (disposed || !windows().length || !enabled()) { stop(); return false; }
    if (!paint(frames[frame], true)) { stop(); return false; }
    painted = true;
    frame = (frame + (busy() ? 2 : 1)) % frames.length;
    return true;
  }

  function refresh() {
    if (disposed || !load()) return;
    if (!windows().length || !enabled()) { stop(); return; }
    if (timer !== null || !tick()) return;
    timer = clock.setInterval(tick, 250);
    timer.unref?.();
  }

  function dispose() { stop(); disposed = true; }
  return { refresh, stop, dispose };
}

module.exports = { identity, applyIdentity, createLauncher };
