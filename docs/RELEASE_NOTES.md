# Draft: Kairo v0.2.2

This is a maintainer template, not a published-release announcement. Update validation and attach verified installers before publishing.

## Your AI workspace, with personality ✦

Kairo brings chat, project context, Git, and agent workflows into one Electron desktop app with an original animated mascot.

### Highlights

- Fix Node-based CLI launch errors when Kairo is opened from Finder.
- Discover common Node installations and pass their paths to CLI subprocesses.

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

Local evidence for 0.2.2: regression tests reproduce a Node-based CLI failing with a minimal PATH, then verify Kairo can run its version check and chat request. Installed Codex was also checked with a Finder-style PATH. This verifies process launching, not a live model response. All 83 local tests and syntax/asset checks passed. The installed Codex CLI failed directly with PATH=/usr/bin:/bin and succeeded through Kairo with the same input environment, returning codex-cli 0.166.0. The unsigned macOS x64 app bundle built successfully and its archive was verified to include the PATH fix and backend setup without private configuration. A ZIP is prepared for local installation. Native Finder interaction, OS keychain behavior, Windows installation and a new live cloud run remain separate release checks.

Before publishing, replace this checklist with the actual evidence:

- [ ] Local syntax/asset checks and tests passed for the tagged commit (working-tree checks passed; repeat CI for the actual tag).
- [ ] GitHub Actions passed on macOS and Windows.
- [ ] Live cloud and selected-provider checks passed.
- [ ] Native installation and desktop behavior checked on each published target.
- [ ] Installer signing/notarization status documented.
- [ ] Only installers from the tested commit attached.

### Known limits

Scheduled tasks run while the app is open and signed in. Local model inference does not disable Firebase sync. The project does not configure Linux installers. Native and live integration status is tracked in [FEATURES.md](../FEATURES.md).
