# Development notes

## Project layout

| Path | Purpose |
| --- | --- |
| `src/main.js` | Electron lifecycle, IPC handlers, project access, and task execution. |
| `src/preload.js` | The renderer's controlled bridge to the main process. |
| `src/renderer.js`, `src/index.html`, `src/styles.css` | Desktop UI. |
| `src/lib/` | Conversation state, providers, sync, storage, MCP, speech, and other services. |
| `src/native/` | Swift macOS helpers and Windows speech support. |
| `cloudflare/` | Private R2 Worker and deployment configuration. |
| `postman/` | Cloud mocks and the local contract simulation. |
| `tests/` | Node test runner suites, CLI fixtures, and DOM checks. |
| `scripts/` | Validation, native/brand builds, deployment, and verification tools. |
| `build/` | Checked-in icons, installer artwork, and the offline setup guide. |

## Providers and permissions

AI-provider authentication is separate from Firebase login. Provider executable paths, native configuration paths, and model overrides can be configured in the app. Leave model overrides empty to honor the CLI's configuration.

Conversation context travels over stdin to the selected CLI. Chat runs with tools disabled and Codex's read-only sandbox. Research enables web tools. Coding workflows use the selected project and request edit permission.

Claude host permission requests appear in an owner-bound dialog. Codex requests project consent before a workspace-write run. App-managed stdio MCP servers are passed to Claude; Codex uses its native MCP configuration.

Semantic search sends the scoped candidate documents to the selected provider for ranking. Consider that data flow when choosing a provider or searching sensitive project material.

## Sync and backups

Firebase Authentication supplies identity. Firestore stores user-scoped records; a local cache and outbox allow optimistic edits and track visible conflicts.

Private R2 stores attachment and backup objects through the included Worker. Encrypted backups use `KAIRO_BACKUP_PASSPHRASE`; referenced attachment objects must remain available for complete restoration. Temporary conversations are excluded from persistent conversations and backups.

Projects synced from another device must be reopened locally before file and Git access is granted.

## Installed-app configuration

Installers exclude environment files. For a packaged app, set `KAIRO_ENV_FILE` to the absolute path of your private environment file, or put `.env` in the app's user-data directory. Restart after changing variables. Process environment values override file values.

The desktop does not require an R2 access key or a Firebase service-account private key. See [FIREBASE_R2_SETUP.md](FIREBASE_R2_SETUP.md) for supported configuration.

## Speech, tasks, and updates

macOS PDF extraction uses the native PDFKit helper. Windows PDFs need Poppler's `pdftotext`. Native dictation uses OS speech recognition; macOS requests on-device recognition. Speech and notification behavior still need native-platform checks.

Scheduled tasks run while Kairo is open and signed in. Missed intervals run once and then advance the original cadence; Activity records the outcome.

Update checks use a configured HTTPS JSON release manifest, for example:

```json
{
  "version": "0.3.0",
  "url": "https://your-site.example/download"
}
```

This is an example manifest, not an available release or download endpoint.

## Local checks and simulation

Run `npm run check` and `npm test` for local validation. The existing [CI workflow](../.github/workflows/verify-build.yml) runs on macOS and Windows and builds unsigned installers.

The optional cloud simulation uses the Postman CLI:

```sh
npm run simulate:cloud
```

It needs a machine that permits local listening ports. The simulation and local fixture tests establish contract behavior; use the [cloud guide](FIREBASE_R2_SETUP.md) for live verification and the [native checklist](USER_CHECKS.md) for desktop checks.

## Artwork

The README GIF and GitHub social preview are derived from the existing mascot frames. Their rebuild instructions are in [assets/README.md](assets/README.md). App branding and installer regeneration are documented in [BRANDING.md](BRANDING.md).
