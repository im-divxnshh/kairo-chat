const fs = require('node:fs');
const path = require('node:path');
const core = require('./core');
const { runFile, executable } = require('./providers');
const ignored = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'release', '.env', '.aws', '.codex', '.claude']);
function inside(root, target) {
  const base = fs.realpathSync(root), resolved = fs.realpathSync(target), relative = path.relative(base, resolved);
  if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) throw new Error('Path is outside the opened project.');
  return resolved;
}
function files(root, { max = 2000, query = '', depth = 0, relative = '' } = {}) {
  const results = [], base = fs.realpathSync(root);
  const walk = (dir, prefix, level) => {
    if (level > 12 || results.length >= max) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const name = path.join(prefix, entry.name);
      if (entry.isDirectory()) walk(path.join(dir, entry.name), name, level + 1);
      else if (entry.isFile() && (!query || name.toLowerCase().includes(query.toLowerCase()))) results.push({ name: entry.name, relative: name, size: fs.statSync(path.join(dir, entry.name)).size });
      if (results.length >= max) return;
    }
  };
  walk(base, relative, depth); return results;
}
function readAttachment(file, settings) {
  const stat = fs.statSync(file); if (!stat.isFile()) throw new Error('Select a regular file.');
  if (stat.size > settings.maxAttachmentMB * 1024 * 1024) throw new Error(`${path.basename(file)} exceeds ${settings.maxAttachmentMB} MB.`);
  const buffer = fs.readFileSync(file), name = path.basename(file), ext = path.extname(file).toLowerCase();
  const images = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
  if (images[ext]) return { id: core.uid(), name, path: file, size: stat.size, kind: 'image', dataURL: `data:${images[ext]};base64,${buffer.toString('base64')}`, sensitive: core.sensitive(file) };
  if (ext === '.pdf') return require('./pdf').extract(file).then(content => {
    const sensitive = core.sensitive(file, content); if (sensitive && settings.blockSensitive) throw new Error('This PDF may contain credentials and was blocked.');
    return { id: core.uid(), name, path: file, size: stat.size, kind: 'text', content, sensitive, language: 'text', sourceType: 'pdf' };
  });
  if (buffer.includes(0)) throw new Error(`${name} is a binary file. Attach text, code or an image.`);
  const content = buffer.toString('utf8'), sensitive = core.sensitive(file, content);
  if (sensitive && settings.blockSensitive) throw new Error(`${name} may contain credentials and was blocked. Review file attachment settings.`);
  return { id: core.uid(), name, path: file, size: stat.size, kind: 'text', content, sensitive, language: ext.slice(1) };
}
function safeRef(ref) { if (typeof ref !== 'string' || !/^[\w./-]{1,200}$/.test(ref) || ref.startsWith('-') || ref.includes('..')) throw new Error('Invalid branch or remote name.'); return ref; }
async function git(root, operation, input = {}) {
  const file = executable('git'); if (!file) throw new Error('Git is not installed.');
  let args;
  switch (operation) {
    case 'status': args = ['status', '--porcelain=v1', '--branch']; break;
    case 'branches': args = ['branch', '--format=%(refname:short)']; break;
    case 'history': args = ['log', '-40', '--format=%h\t%s\t%an\t%ar']; break;
    case 'diff': args = ['diff', ...(input.staged ? ['--cached'] : []), '--', ...(input.file ? [input.file] : [])]; break;
    case 'stage': if (!input.file) throw new Error('Choose a file.'); { const target = path.resolve(root, input.file); inside(root, fs.existsSync(target) ? target : path.dirname(target)); } args = ['add', '--', input.file]; break;
    case 'unstage': if (!input.file) throw new Error('Choose a file.'); args = ['restore', '--staged', '--', input.file]; break;
    case 'commit': if (!input.message?.trim()) throw new Error('Write a commit message.'); args = ['commit', '-m', input.message]; break;
    case 'switch': args = ['switch', safeRef(input.branch)]; break;
    case 'create': args = ['switch', '-c', safeRef(input.branch)]; break;
    case 'merge': args = ['merge', '--no-edit', safeRef(input.branch)]; break;
    case 'pull': args = ['pull', '--ff-only', safeRef(input.remote || 'origin')]; break;
    case 'push': args = ['push', safeRef(input.remote || 'origin')]; break;
    case 'stash': args = ['stash', 'push', '-m', input.message || 'Kairo stash']; break;
    case 'stashList': args = ['stash', 'list']; break;
    case 'stashPop': args = ['stash', 'pop']; break;
    case 'conflicts': args = ['diff', '--name-only', '--diff-filter=U']; break;
    default: throw new Error('Unknown Git action.');
  }
  const result = await runFile(file, args, { cwd: root, timeout: ['push', 'pull'].includes(operation) ? 120000 : 30000 });
  if (result.code !== 0) throw new Error(result.stderr || result.stdout || 'Git command failed.');
  return result.stdout || result.stderr;
}
async function repository(root) { try { const result = await runFile(executable('git'), ['rev-parse', '--is-inside-work-tree'], { cwd: root }); return result.code === 0 && result.stdout === 'true'; } catch { return false; } }
module.exports = { inside, files, readAttachment, safeRef, git, repository };
