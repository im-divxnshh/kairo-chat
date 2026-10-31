# Security policy

## Supported versions

Kairo is an early-stage project. Security fixes target the latest code on the default branch and the latest released version; older releases have no separate maintenance commitment.

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting](https://github.com/im-divxnshh/kairo-chat/security/advisories/new) when it is enabled. If the option is unavailable, use an available private contact method on the [maintainer's GitHub profile](https://github.com/im-divxnshh). If neither route is available, open an issue asking for a private reporting channel without disclosing the vulnerability.

Include the affected version, OS, a minimal reproduction, expected impact, and any suggested fix. Redact tokens, passwords, user data, and cloud identifiers that are not needed to reproduce the issue. Avoid publishing exploit details before maintainers can investigate.

## Relevant boundaries

Security-sensitive areas include Firebase user isolation, Worker token verification, R2 access, backup encryption, Electron IPC, local project permissions, CLI execution, and MCP tools. Provider authentication, Firebase login, and backup passphrases have separate purposes; see the [README](README.md#-your-workspace-explained).

Only test against your own resources or resources you have permission to test. This project does not offer a bug bounty or a guaranteed response time.
