const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function installations(root, child = 'bin', match = /^v?\d+\.\d+(?:\.\d+)?(?:[-+].*)?$/) {
  try {
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(entry => (entry.isDirectory() || entry.isSymbolicLink()) && match.test(entry.name))
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }))
      .map(entry => path.join(root, entry.name, child));
  } catch { return []; }
}

function searchDirectories({ env = process.env, home = os.homedir(), platform = process.platform, executablePath = '', runtimePath = process.versions.electron ? '' : process.execPath } = {}) {
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH');
  const inherited = (env.PATH || env[pathKey] || '').split(platform === 'win32' ? ';' : ':');
  const directories = [path.isAbsolute(executablePath) ? path.dirname(executablePath) : '', ...inherited, runtimePath ? path.dirname(runtimePath) : ''];
  if (platform === 'win32') {
    directories.push(path.join(env.APPDATA || path.join(home, 'AppData/Roaming'), 'npm'), path.join(env.ProgramFiles || 'C:/Program Files', 'nodejs'), path.join(home, 'scoop/shims'), path.join(env.VOLTA_HOME || path.join(home, '.volta'), 'bin'), env.NVM_SYMLINK || '');
  } else {
    directories.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
      path.join(home, '.local/bin'), path.join(home, '.npm-global/bin'), path.join(home, '.volta/bin'),
      path.join(home, '.asdf/shims'), path.join(home, '.nodenv/shims'), path.join(home, '.local/share/mise/shims'),
      path.join(home, 'Library/pnpm'), path.join(home, '.local/share/pnpm'),
      ...installations(path.join(env.NVM_DIR || path.join(home, '.nvm'), 'versions/node')),
      ...[path.join(home, '.fnm'), path.join(home, '.local/share/fnm'), path.join(home, 'Library/Application Support/fnm')]
        .flatMap(root => installations(path.join(root, 'node-versions'), 'installation/bin')),
      ...installations(path.join(home, '.local/share/mise/installs/node')),
      ...['/opt/homebrew/opt', '/usr/local/opt'].flatMap(root => installations(root, 'bin', /^node(?:@\d+)?$/)));
  }
  return [...new Set(directories.filter(Boolean))];
}

function executionEnvironment(base = process.env, executablePath = '') {
  const env = { ...base }, directories = searchDirectories({ env, executablePath });
  // Windows environment keys are case-insensitive; avoid passing two PATH values.
  for (const key of Object.keys(env)) if (key.toUpperCase() === 'PATH') delete env[key];
  env.PATH = directories.join(path.delimiter);
  return env;
}

module.exports = { searchDirectories, executionEnvironment };
