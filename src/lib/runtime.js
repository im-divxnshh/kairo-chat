const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createProject(parent, name) {
  if (typeof name !== 'string' || !name.trim() || /[<>:"/\\|?*\x00-\x1f]/.test(name) || /^(\.|\.\.|CON|PRN|AUX|NUL|COM\d|LPT\d)(\..*)?$/i.test(name) || /[. ]$/.test(name)) throw new Error('Choose a valid project folder name.');
  const base = fs.realpathSync(parent), target = path.join(base, name);
  fs.mkdirSync(target); // Never overwrite an existing project.
  return fs.realpathSync(target);
}
function nextSchedule(schedule, now = Date.now()) {
  const interval = schedule.intervalMinutes * 60000;
  if (!Number.isFinite(interval) || interval < 60000) throw new Error('Invalid schedule interval.');
  const due = Number.isFinite(schedule.nextRunAt) ? schedule.nextRunAt : now;
  const missedRuns = Math.max(0, Math.floor((now - due) / interval));
  return { ...schedule, lastRunAt: now, missedRuns: (schedule.missedRuns || 0) + missedRuns, nextRunAt: due + (missedRuns + 1) * interval };
}
function backupDue(settings, lastBackup, now = Date.now()) {
  return settings.backups && now - lastBackup >= settings.backupMinutes * 60000;
}
function copyStorage(source, parent) {
  const base = fs.realpathSync(parent), destination = path.join(base, 'KairoData');
  const relative = path.relative(source, destination), reverse = path.relative(destination, source);
  if (!relative || !relative.startsWith('..' + path.sep) || !reverse.startsWith('..' + path.sep)) throw new Error('Choose a separate folder outside the current data directory.');
  if (fs.existsSync(destination) && fs.readdirSync(destination).length) throw new Error('KairoData already contains files. Choose an empty destination.');
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false, dereference: false });
  return destination;
}
function conflictFiles(root, names) {
  const { inside } = require('./workspace');
  return names.split('\n').filter(Boolean).map(file => {
    const target = inside(root, path.resolve(root, file)), stat = fs.statSync(target);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('Conflict file exceeds the text limit.');
    const buffer = fs.readFileSync(target);
    if (buffer.includes(0)) throw new Error('Binary conflicts must be resolved outside Kairo.');
    return { file, content: buffer.toString('utf8'), hash: crypto.createHash('sha256').update(buffer).digest('hex') };
  });
}
function applyResolution(root, { file, content, hash }) {
  const { inside } = require('./workspace');
  if (typeof content !== 'string' || Buffer.byteLength(content) > 2 * 1024 * 1024 || /^(<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(content)) throw new Error('Resolution must contain text with no remaining conflict markers.');
  const target = inside(root, path.resolve(root, file)), original = fs.readFileSync(target);
  if (crypto.createHash('sha256').update(original).digest('hex') !== hash) throw new Error('The file changed since the preview. Generate a new resolution.');
  if (!/^<<<<<<< /m.test(original.toString('utf8'))) throw new Error('The file no longer has conflict markers.');
  const backup = target + '.kairo-conflict-' + crypto.randomUUID() + '.bak';
  fs.copyFileSync(target, backup, fs.constants.COPYFILE_EXCL);
  const temporary = target + '.kairo-' + crypto.randomUUID();
  try { fs.writeFileSync(temporary, content, { mode: fs.statSync(target).mode }); fs.renameSync(temporary, target); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return { file, backup: path.basename(backup) };
}
function terminalCommand(cwd, settings, platform = process.platform) {
  const { executable } = require('./providers');
  if (settings.terminalPath) {
    if (!path.isAbsolute(settings.terminalPath)) throw new Error('Terminal executable must use an absolute path.');
    return { file: executable('', settings.terminalPath), args: settings.terminalArgs.map(arg => arg.replaceAll('{cwd}', cwd)) };
  }
  if (platform === 'darwin') return { file: '/usr/bin/open', args: ['-a', 'Terminal', cwd] };
  if (platform === 'win32') { const file = executable('wt'); if (file) return { file, args: ['-d', cwd] }; throw new Error('Install Windows Terminal or set a custom terminal executable.'); }
  for (const [name, args] of [['gnome-terminal', ['--working-directory=' + cwd]], ['konsole', ['--workdir', cwd]], ['x-terminal-emulator', []]]) { const file = executable(name); if (file) return { file, args }; }
  throw new Error('Select an installed terminal in Settings.');
}
module.exports = { createProject, nextSchedule, backupDue, copyStorage, conflictFiles, applyResolution, terminalCommand };
