# Troubleshooting installed Kairo

## `env: node: No such file or directory`

This comes from a Node-based CLI launcher. Apps opened from Finder can inherit a smaller PATH than Terminal, so the CLI may be present while its Node interpreter cannot be found.

Kairo 0.2.2 shares executable discovery paths with CLI subprocesses. It searches common Homebrew, nvm, fnm, Volta, asdf, mise, npm and OS locations, along with the selected CLI's directory. It does not source shell startup files or install Node automatically.

1. Install Node.js 22+ if it is not installed, then quit and reopen Kairo.
2. In Terminal, check the installed executables:

   ```sh
   command -v node
   command -v codex
   command -v claude
   ```

3. For an unusual installation location, open Settings → Providers → Edit and select the CLI executable from the same installation as Node. The executable setting is the path to `codex` or `claude`, rather than the Node binary.
4. Click **Test connection**. A successful CLI version/authentication check verifies startup; send a small chat to verify the provider response separately.

As a temporary workaround for an older macOS installation, quit Kairo and launch it from Terminal so it inherits your terminal PATH:

```sh
/Applications/Kairo.app/Contents/MacOS/Kairo
```

Backend settings remain saved in the same user-data directory. CLI authentication remains separate from the Firebase login.

## Backend setup before login

Open **Set up my backend** on the sign-in screen and save your own Firebase web API key and project ID. An R2 Worker URL is optional for text-only work. Kairo remembers saved settings automatically; an installed app does not require `.env`. See [FIREBASE_R2_SETUP.md](FIREBASE_R2_SETUP.md).
