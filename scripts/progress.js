const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/features.json')));
const labels = { done: 'Complete', partial: 'In progress', pending: 'Pending', blocked: 'Needs setup / verification', replaced: 'Replaced', deferred: 'Deferred by user' };
const groups = [
  ['Original features', data.features],
  ['Firebase additions', data.firebase],
  ['Environment, R2 and performance additions', data.storage || []],
  ['Branding additions', data.branding || []],
];
const all = groups.flatMap(([, entries]) => entries);
const count = (entries, status) => entries.filter(f => f.status === status).length;
const done = count(all, 'done');
const lines = [
  '# Kairo implementation checklist', '',
  `Last updated: ${new Date().toISOString().slice(0, 10)}`, '',
  `**Overall: ${done} / ${all.length} checklist items complete (${(done / all.length * 100).toFixed(1)}%). ${all.length - done - count(all, 'replaced') - count(all, 'deferred')} active items remain; ${count(all, 'deferred')} deferred; ${count(all, 'replaced')} replaced.**`, '',
  '| Scope | Complete | Total | Completion |',
  '| --- | ---: | ---: | ---: |',
];
for (const [name, entries] of groups) {
  const complete = count(entries, 'done');
  lines.push(`| ${name} | ${complete} | ${entries.length} | ${entries.length ? (complete / entries.length * 100).toFixed(1) : '0.0'}% |`);
}
lines.push(
  '', `Remaining work: **${count(all, 'partial')} in progress**, **${count(all, 'blocked')} need setup or verification**, **${count(all, 'pending')} pending**. Separately, **${count(all, 'deferred')} deferred until later** and **${count(all, 'replaced')} items are replaced** and do not require implementation.`, '',
  `Implementation tasks left: **${count(all, 'partial') + count(all, 'pending')}**. External checks delegated to the user: **${count(all, 'blocked')}**. See [USER_CHECKS.md](docs/USER_CHECKS.md).`, '',
  'Verification uses unit tests, isolated Git repositories, fake CLI subprocesses and DOM UI tests. Live Firebase/R2 verification and Codex responses passed in the user’s terminal on 2026-10-31. Native desktop and remaining live checks are tracked separately; local tests do not establish those results.', '',
  'A checked feature has an implemented application path and verification evidence. In-progress code, configuration screens, untested integrations, and installer commands alone do not count as complete. Category checkboxes are checked only when every feature in the category is complete.', '',
  'Firebase Authentication and Cloud Firestore are the requested identity and primary database. Feature 203 (SQLite) is retained for traceability and marked replaced, rather than silently removed or counted as complete.', '',
  '| Category | Complete | In progress | Needs setup | Pending / deferred / replaced |',
  '| --- | ---: | ---: | ---: | ---: |',
);
for (const category of [...new Set(all.map(f => f.category))]) {
  const entries = all.filter(f => f.category === category);
  lines.push(`| ${category} | ${entries.filter(f => f.status === 'done').length}/${entries.length} | ${entries.filter(f => f.status === 'partial').length} | ${entries.filter(f => f.status === 'blocked').length} | ${entries.filter(f => ['pending', 'deferred', 'replaced'].includes(f.status)).length} |`);
}
for (const category of [...new Set(all.map(f => f.category))]) {
  const entries = all.filter(f => f.category === category), count = entries.filter(f => f.status === 'done').length;
  lines.push('', `## ${category}`, '', `- [${count === entries.length ? 'x' : ' '}] Category complete — ${count}/${entries.length}`, '');
  for (const f of entries) lines.push(`- [${f.status === 'done' ? 'x' : ' '}] **${f.id}. ${f.name}** — ${labels[f.status]}${f.evidence ? `. ${f.evidence}` : '.'}`);
}
lines.push('', '## Updating progress', '', 'Edit the feature status and evidence in `docs/features.json`, then run `npm run progress`. Use `done` only after exercising the feature. Supported states: `pending`, `partial`, `blocked`, `deferred`, `replaced`, `done`. This file and the in-app progress screen use the same source.', '');
fs.writeFileSync(path.join(root, 'FEATURES.md'), lines.join('\n'));
console.log(`${done}/${all.length} features complete (${(done / all.length * 100).toFixed(1)}%); ${all.length - done - count(all, 'replaced') - count(all, 'deferred')} active items remain; ${count(all, 'deferred')} deferred; ${count(all, 'replaced')} replaced. Checklist: FEATURES.md`);
