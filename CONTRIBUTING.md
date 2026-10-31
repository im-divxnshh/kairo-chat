# Contributing to Kairo

Thanks for helping make Kairo better. Docs, bug reports, accessibility fixes, and native-platform verification are all useful contributions.

## Find something to work on

Check [open issues](https://github.com/im-divxnshh/kairo-chat/issues) and [FEATURES.md](FEATURES.md). For a larger feature or architectural change, open an issue explaining the problem and proposed behavior before spending time on an implementation. For a focused fix, a pull request with clear context is welcome.

Follow our [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Set up locally

1. Fork the repository and clone your fork.
2. Install Node.js 22+; CI uses Node.js 24.
3. Run `npm ci`.
4. Follow the [README setup](README.md#-get-it-running) to run the app with your own cloud resources or Firebase emulators. macOS needs Xcode Command Line Tools for native helpers.
5. Create a branch: `git switch -c fix/describe-your-change`.

Local syntax checks and the fixture-based test suite can run without production credentials. App startup and live verification need the configuration described in the cloud guide.

## Keep changes focused

- Match the surrounding JavaScript style; the application uses CommonJS, with an ES module for the Worker.
- Keep the renderer behind the existing preload/IPC boundary. Preserve permission checks around project access and AI edits.
- Update docs when setup, user behavior, or configuration changes.
- Add a regression test for a behavior change when it can meaningfully reproduce the bug. Docs-only changes usually need link and formatting checks.
- Update feature status only when there is evidence for the claim; local mocks do not prove live or native behavior.
- Keep `.env`, `.dev.vars`, credentials, private conversations, local reports, and generated installers out of commits.

The `build/` directory contains required, checked-in artwork despite its name. Keep those assets. Native executables, `.native-cache/`, and `release/` are generated locally. The README artwork is also checked in; see [docs/assets/README.md](docs/assets/README.md) to rebuild it.

## Verify your change

```sh
npm run check
npm test
```

For native changes, also run `npm run build:native` on macOS and record the manual checks you performed. For cloud changes, run relevant contract tests and follow the live verification guide when your change affects deployment behavior. Describe checks you could not run instead of marking them passed.

## Open a pull request

Explain the problem, the resulting behavior, and your validation. Include screenshots or a short recording for visual changes and the OS/architecture for platform work. Link a relevant issue with `Closes #123` when appropriate.

Keep unrelated refactors out of the same PR. There is no required commit-message convention; a concise description of the change is enough. Maintainer review and CI determine when a change can merge.

By submitting a contribution, you agree to license it under the project's [MIT license](LICENSE). Dependencies and contributed artwork must have compatible licenses and appropriate attribution.
