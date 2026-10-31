# Kairo checks to run on your machine

The remaining checks require native desktop access, external connectivity or Windows. They are delegated to you as requested. Firebase/R2's 20 live checks and your Codex live response already passed; keep the existing successful cloud report.

## Claude deferred until later

Claude troubleshooting is deferred at your request. Kairo uses Codex for now with `KAIRO_ACTIVE_PROVIDER=codex` in your private `.env`. The Claude instructions below are for later; **16 external checks remain active, with 1 Claude check deferred**.

- **#1 (deferred):** When you return to Claude, run `npm run verify:cli -- --provider claude`. It must print a live-response PASS using your `settings.json`. Authentication alone does not count. Your first attempt timed out after 60 seconds.

  If it times out, isolate customizations with:

  ```sh
  npm run verify:cli -- --provider claude --safe-mode --timeout 120
  ```

  The verifier prints the configured gateway/model and whether the timeout occurred during startup, an initialized request or a partial response. Safe mode uses the native CLI’s troubleshooting flag, retaining the selected configuration file and leaving your settings untouched. A safe-mode PASS followed by a normal-mode timeout points to customizations such as hooks/plugins; check those and repeat normal mode. If both time out after initialization, check gateway connectivity and whether it supports the configured model. OAuth authentication status alone does not verify a custom gateway token. A safe-mode PASS does not complete the normal-mode check.

## GitHub and research with Codex

- **#87:** Run `gh auth login` if needed. Open a local GitHub repository in Kairo, open Pull requests, then try Summarize and Review on a real PR. These produce drafts in Kairo.
- **#225:** In Tasks, run Browser research through Codex. Confirm that it retrieves current sources and supplies citations.

## Native desktop

Start development with `npm start`, or open `release/mac/Kairo.app`. For the packaged app, set `KAIRO_ENV_FILE` to the absolute path of your existing private `.env` before launching the app executable:

```sh
KAIRO_ENV_FILE="$PWD/.env" "release/mac/Kairo.app/Contents/MacOS/Kairo"
```

- **#229:** Launch the refreshed app, sign in and complete a streamed chat. This sandbox cannot launch Electron.
  Confirm the name is Kairo and the lavender-haired anime icon appears in the Dock. Watch it blink, then disable **Settings → Appearance → Animate Dock / taskbar icon** and confirm it stops. Enable it again, test **Reduced motion**, and close/reopen a window. Quit to confirm the static icon returns.
- **#69:** Open two project windows. Confirm each opens the selected project and can be used independently.
- **#140, #145:** Test minimize/maximize/close and enter/exit full screen.
- **#163:** Select a project and open its terminal. Confirm the terminal starts in the project folder. Try your custom terminal setting if used.
- **#195, #196:** Enable desktop notifications and sound. Choose a small WAV/MP3 sound, finish a task, and confirm one sound plays. Reset to the system sound and repeat. Allow OS notification permission if requested.
- **#227:** Start dictation, allow microphone and speech permissions, speak and stop. Confirm text appears in the draft. macOS requires on-device recognition for your language; Windows requires installed native speech support.
- **#228:** Complete a chat, click Read response and confirm audible speech.

## Installers and Windows

The GitHub Actions workflow checks code and builds macOS x64/arm64 DMGs plus Windows x64 NSIS/MSI artifacts when run in a repository. It has not run in this environment. You can also build locally on the target OS:

```sh
npm run dist:mac:x64
npm run dist:mac:arm64
# On Windows:
npm run dist:win
npm run dist:win:msi
```

- **#231:** Build the DMG for your Mac architecture, mount it, copy Kairo to Applications and launch it.
  Confirm the lime/pink/lavender background, the app-to-Applications arrow, and the Kairo volume icon. Open **Start here.html** to view the animated setup guide; test its pause button and system reduced motion. The Finder background is static.
- **#230, #232, #233:** On Windows, build and install the EXE/MSI separately, launch Kairo and test sign-in, chat, a project terminal and dictation.
  Confirm the anime icon and Kairo name in the installer and shortcuts. The EXE should show the matching sidebar/header. Watch the running taskbar overlay, then disable the Appearance animation setting and confirm the overlay clears. Pinned and closed shortcuts keep the static mascot icon.

The local macOS app is unsigned. Signing/notarization needs your signing identity. Environment and CLI credential files are excluded from the bundle; installed apps still need your private environment configuration.

## Firebase emulators

- **F10:** Run `firebase emulators:start --only auth,firestore --project demo-kairo`. Use the auth and Firestore emulator variables in [FIREBASE_R2_SETUP.md](FIREBASE_R2_SETUP.md), leave R2 unset, then test signup, login and text conversation persistence. Production R2 correctly rejects unsigned emulator tokens. Emulator verification is separate from the live rules verification that already passed.

After each check passes, update that entry's evidence and status to `done` in `docs/features.json`, then run `npm run progress`. Keep checks that have not run unchecked.
