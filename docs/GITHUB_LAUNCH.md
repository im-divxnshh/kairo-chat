# Launch Kairo on GitHub

Target repository: [im-divxnshh/kairo-chat](https://github.com/im-divxnshh/kairo-chat).

## Copy-paste repository details

**Name:** `kairo-chat`

**Description:**

> Your AI workspace. Your CLI. Your flow. An open-source desktop app for Codex, Claude Code, and Ollama with projects, Git, agent workflows, and Firebase sync.

**Topics** (add them individually in the repository's About settings):

```text
ai
ai-workspace
ai-agents
desktop-app
electron
javascript
codex
claude-code
ollama
mcp
firebase
firestore
cloudflare-r2
developer-tools
open-source
```

Leave Website empty until you have a real landing page. Use [docs/assets/social-preview.png](assets/social-preview.png) in **Settings → General → Social preview**. The image is 1280 × 640, the recommended 2:1 shape.

## Create the repository and make the first push

This workspace did not have a Git repository when the launch docs were prepared.

1. On GitHub, create a **public** repository named `kairo-chat` under `im-divxnshh`.
2. Leave GitHub's README, license, and .gitignore initialization options unchecked; those files are already prepared locally.
3. In this project's terminal, initialize and stage the project:

```sh
git init -b main
git add .
git diff --cached --stat
git status --short
```

Review the staged files. The project's ignore rules exclude local environment files, Cloudflare runtime state, dependency folders, generated native helpers, test reports, and installers. Keep `build/`, the mascot frames, and `docs/assets/`: they contain required source artwork.

Confirm that `.env`, `cloudflare/.dev.vars`, and generated files remain excluded:

```sh
git check-ignore .env cloudflare/.dev.vars node_modules release .native-cache src/native/kairo-pdf src/native/kairo-speech
```

Then commit and push:

```sh
git commit -m "Prepare Kairo for open source"
git remote add origin https://github.com/im-divxnshh/kairo-chat.git
git push -u origin main
```

If you already initialized Git or configured an `origin`, inspect `git status` and `git remote -v` first and skip the corresponding initialization step. Do not overwrite an existing remote or force-push unrelated history.

## Set up the community

- Add the description and topics in the repository's **About** panel.
- Upload the social preview in **Settings → General**.
- Enable **Issues** and optionally **Discussions**. Create a welcome discussion if you enable it.
- Enable **Private vulnerability reporting** under the repository's security settings so [SECURITY.md](../SECURITY.md) has an active private reporting route.
- Enable dependency alerts and review Dependabot pull requests; [.github/dependabot.yml](../.github/dependabot.yml) schedules weekly npm updates.
- After the first Actions run, inspect both verify jobs and the installer artifacts. The README's CI badge reflects actual workflow status.
- Once CI is established, protect `main` with a pull-request requirement and the actual verification job names shown by Actions. Choose requirements that fit a solo-maintainer project.
- Add useful issue labels such as `bug`, `enhancement`, `documentation`, `help wanted`, and `good first issue`. Only use `good first issue` for work with a clear scope and starting point.

The repository already includes an MIT license, contribution guide, conduct policy, security policy, issue forms, a pull-request template, and CODEOWNERS.

## Prepare the first release

Builds from CI are unsigned and are not automatically published as releases. Complete the relevant [native checks](USER_CHECKS.md) and live verification before publishing downloadable installers. Signing and notarization remain separate tasks.

When v0.2.0 is ready, create a `v0.2.0` tag for the tested commit and a GitHub Release titled:

> Kairo v0.2.0 — your AI workspace, with personality

Use the [release-notes draft](RELEASE_NOTES.md), edit it to reflect the checks actually completed, and attach the matching DMG/EXE/MSI files. If desktop verification is incomplete, keep the release a draft or clearly marked prerelease. Never upload a private environment file.

## Short launch post

> Meet Kairo ✦ Less tab chaos, more main character energy. A desktop home for Codex, Claude Code, and Ollama, with project context, Git, agent workflows, and your own Firebase sync. Early-stage, MIT licensed, and open for contributions.
>
> https://github.com/im-divxnshh/kairo-chat
