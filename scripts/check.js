const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir,e.name)) : /\.(js|mjs)$/.test(e.name) ? [path.join(dir,e.name)] : []); }
const files = ['src','scripts','tests','cloudflare','postman/mocks'].flatMap(dir => walk(path.join(root,dir)));
for (const file of files) execFileSync(process.execPath, ['--check',file], { stdio: 'pipe' });
const packageJSON = JSON.parse(fs.readFileSync(path.join(root,'package.json')));
require('./verify-brand')(root);
if (!packageJSON.build.files.includes('!.env*')) throw new Error('Build must exclude environment files.');
const html = fs.readFileSync(path.join(root,'src/index.html'),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML element IDs.');
const features = JSON.parse(fs.readFileSync(path.join(root,'docs/features.json')));
if (features.features.length !== 233) throw new Error('Feature checklist must include all 233 original entries.');
console.log(`Syntax checked ${files.length} JavaScript files; HTML, packaging and feature metadata checked.`);
