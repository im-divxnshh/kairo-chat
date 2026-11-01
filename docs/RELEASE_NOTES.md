# Draft: Kairo v0.2.1

This is a maintainer template, not a published-release announcement. Update validation and attach verified installers before publishing.

## Your AI workspace, with personality ✦

Kairo brings chat, project context, Git, and agent workflows into one Electron desktop app with an original animated mascot.

### Highlights

- First-run backend setup: enter your own Firebase settings and R2 Worker URL inside the app; settings persist across restarts without `.env`.
- OS-protected storage for backend settings and optional backup passphrases.

- Codex and Claude Code through native CLI configurations, plus optional local Ollama inference.
- Streaming conversations with branches, attachments, Markdown, and common LaTeX rendering.
- Project browsing, Git actions, prompt templates, saved memory, and agent workflows.
- Firebase accounts and Firestore sync, with private R2 attachments and encrypted backups.
- Native speech features, appearance presets, and a Dock/taskbar mascot with reduced-motion controls.
- Open-source onboarding: MIT license, contribution docs, issue forms, and an animated README.

### Setup

This release requires your own Firebase configuration and provider authentication. R2 is needed for cloud attachments and backups. See the [README](../README.md) and [cloud setup guide](FIREBASE_R2_SETUP.md).

### Release validation

Local evidence for 0.2.1: all 80 tests and syntax/asset checks passed. The x64 native helpers and unsigned macOS app bundle built successfully; the bundle contains backend setup and excludes private configuration. DMG creation failed in the workspace with `hdiutil: create failed - Device not configured`. An unsigned ZIP of the app is available as a local alternative. Native installation, keychain behavior, Windows builds and a new live cloud run remain unverified here.

Before publishing, replace this checklist with the actual evidence:

- [ ] Local syntax/asset checks and tests passed for the tagged commit (working-tree checks passed; repeat CI for the actual tag).
- [ ] GitHub Actions passed on macOS and Windows.
- [ ] Live cloud and selected-provider checks passed.
- [ ] Native installation and desktop behavior checked on each published target.
- [ ] Installer signing/notarization status documented.
- [ ] Only installers from the tested commit attached.

### Known limits

Scheduled tasks run while the app is open and signed in. Local model inference does not disable Firebase sync. The project does not configure Linux installers. Native and live integration status is tracked in [FEATURES.md](../FEATURES.md).
