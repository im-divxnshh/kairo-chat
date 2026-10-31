const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { applyIdentity, createLauncher, identity } = require('../src/lib/branding');
const verifyBrand = require('../scripts/verify-brand');
const root = path.resolve(__dirname, '..');

function harness(platform = 'darwin', missing = '') {
  let settings = {}, working = false, reduced = false;
  const dock = [], timers = new Set(), images = [];
  function window() {
    return { destroyed: false, icons: [], overlays: [], isDestroyed() { return this.destroyed; },
      setIcon(image) { this.icons.push(image); }, setOverlayIcon(image, label) { this.overlays.push({ image, label }); } };
  }
  const windows = [window()];
  const nativeImage = { createFromPath(file) {
    const image = { file: path.basename(file), isEmpty: () => path.basename(file) === missing,
      resize: size => ({ file: path.basename(file), ...size }) };
    images.push(image); return image;
  } };
  const clock = { setInterval(tick, ms) { assert.equal(ms, 250); const timer = { tick, unref() {} }; timers.add(timer); return timer; },
    clearInterval(timer) { timers.delete(timer); } };
  const launcher = createLauncher({ platform, app: { dock: { setIcon: image => dock.push(image.file) } },
    BrowserWindow: { getAllWindows: () => windows }, nativeImage,
    systemPreferences: { getAnimationSettings: () => ({ prefersReducedMotion: reduced }) },
    settings: () => settings, busy: () => working, clock });
  return { launcher, dock, timers, windows, images, window, tick: () => [...timers].forEach(timer => timer.tick()),
    settings: value => settings = value, busy: value => working = value, reduced: value => reduced = value };
}

test('Kairo identity preserves an existing data directory and sets the Windows app ID', () => {
  let name = 'old-name', location = '/existing/private-data', appId;
  applyIdentity({ getPath: key => { assert.equal(key, 'userData'); return location; },
    setName(value) { name = value; location = '/new/default'; },
    setPath(key, value) { assert.equal(key, 'userData'); location = value; },
    setAppUserModelId: value => appId = value }, 'win32');
  assert.equal(name, 'Kairo'); assert.equal(location, '/existing/private-data');
  assert.equal(appId, 'com.kairo.chat');
});

test('Dock frames advance, accelerate during work, use one timer and restore on close', () => {
  const h = harness();
  h.launcher.refresh(); h.launcher.refresh(); assert.equal(h.timers.size, 1);
  assert.equal(h.dock.at(-1), 'frame-00.png');
  h.tick(); assert.equal(h.dock.at(-1), 'frame-01.png');
  h.busy(true); h.tick(); h.tick(); assert.equal(h.dock.at(-1), 'frame-04.png');
  for (let i = 0; i < 40; i++) h.tick();
  assert.ok(h.dock.slice(0, -1).includes('frame-30.png'));
  h.windows[0].destroyed = true; h.tick();
  assert.equal(h.timers.size, 0); assert.equal(h.dock.at(-1), 'icon.png');
  h.windows.push(h.window()); h.launcher.refresh(); assert.equal(h.timers.size, 1);
  h.launcher.dispose(); assert.equal(h.timers.size, 0); assert.equal(h.dock.at(-1), 'icon.png');
  const count = h.dock.length; h.launcher.refresh(); assert.equal(h.dock.length, count);
});

test('launcher setting and app/OS reduced motion stop updates and allow restart', () => {
  const h = harness();
  for (const setting of [{ animatedLauncher: false }, { reducedMotion: true }]) {
    h.launcher.refresh(); assert.equal(h.timers.size, 1);
    h.settings(setting); h.launcher.refresh(); assert.equal(h.timers.size, 0);
    assert.equal(h.dock.at(-1), 'icon.png'); h.settings({});
  }
  h.launcher.refresh(); h.reduced(true); h.tick(); assert.equal(h.timers.size, 0);
  h.launcher.refresh(); assert.equal(h.timers.size, 0);
  h.reduced(false); h.launcher.refresh(); assert.equal(h.timers.size, 1); h.launcher.dispose();
});

test('Windows animates live windows and a small taskbar overlay, then restores static icons', () => {
  const h = harness('win32'), first = h.windows[0], second = h.window(), closed = h.window();
  closed.destroyed = true; h.windows.push(second, closed); h.launcher.refresh(); h.tick();
  for (const window of [first, second]) {
    assert.equal(window.icons.at(-1).file, 'frame-01.png');
    assert.deepEqual(window.overlays.at(-1), { image: { file: 'frame-01.png', width: 16, height: 16 }, label: 'Kairo is running' });
  }
  assert.equal(closed.icons.length, 0);
  h.busy(true); h.tick(); assert.equal(first.overlays.at(-1).label, 'Kairo is working');
  h.launcher.dispose();
  for (const window of [first, second]) {
    assert.equal(window.icons.at(-1).file, 'icon.png');
    assert.deepEqual(window.overlays.at(-1), { image: null, label: '' });
  }
  assert.equal(h.timers.size, 0);
});

test('missing images and unavailable native APIs do not crash or leave an animation timer', () => {
  for (const missing of ['icon.png', 'frame-12.png']) {
    const h = harness('darwin', missing); h.launcher.refresh(); h.launcher.refresh(); h.launcher.dispose();
    assert.equal(h.timers.size, 0); assert.equal(h.dock.length, 0);
    assert.ok(h.images.length <= 33);
  }
  const h = harness('linux'); h.launcher.refresh(); assert.equal(h.images.length, 0);
  const launcher = createLauncher({ platform: 'darwin', app: { dock: { setIcon() { throw new Error('closed'); } } },
    BrowserWindow: { getAllWindows: () => h.windows },
    nativeImage: { createFromPath: () => ({ isEmpty: () => false }) },
    clock: { setInterval() { assert.fail('Native failure must not create a timer.'); }, clearInterval() {} } });
  assert.doesNotThrow(() => { launcher.refresh(); launcher.dispose(); });
});

test('prebuilt branding formats pass packaging validation and duplicated frames fail', () => {
  assert.deepEqual(verifyBrand(), { frames: 32, windowsSizes: 7 });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kairo-brand-test-'));
  try {
    fs.cpSync(path.join(root, 'build'), path.join(directory, 'build'), { recursive: true });
    fs.cpSync(path.join(root, 'src/assets/branding'), path.join(directory, 'src/assets/branding'), { recursive: true });
    const frames = path.join(directory, 'src/assets/branding/frames');
    fs.copyFileSync(path.join(frames, 'frame-00.png'), path.join(frames, 'frame-01.png'));
    assert.throws(() => verifyBrand(directory), /32 distinct frames/);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  assert.equal(path.basename(identity.icon), 'icon.png');
});

test('standalone animated setup guide has working pause/resume controls and local assets', () => {
  const errors = [], virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'build/Start here.html'), 'utf8'),
    { runScripts: 'dangerously', virtualConsole });
  try {
    const document = dom.window.document, button = document.getElementById('motion');
    assert.equal(document.querySelectorAll('.card').length, 3);
    assert.ok(document.querySelector('.portrait svg .anime-eyes'));
    button.click(); assert.ok(document.body.classList.contains('paused'));
    assert.equal(button.getAttribute('aria-pressed'), 'true'); assert.equal(button.textContent, 'Resume animation');
    button.click(); assert.ok(!document.body.classList.contains('paused'));
    assert.equal(button.getAttribute('aria-pressed'), 'false'); assert.equal(button.textContent, 'Pause animation');
    assert.match(document.querySelector('style').textContent, /prefers-reduced-motion:reduce/);
    assert.ok([...document.querySelectorAll('[src]')].every(element => element.getAttribute('src').startsWith('data:')));
    assert.match(document.querySelector('meta[http-equiv]').content, /default-src 'none'/);
    assert.deepEqual(errors, []);
  } finally { dom.window.close(); }
});
