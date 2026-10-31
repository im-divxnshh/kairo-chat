# Cloud contracts

The desktop app uses Firebase Authentication for identity, Cloud Firestore for account records, and a private Cloudflare R2 bucket for attachments and encrypted backups. Networking runs in Electron's main process. The renderer has no network access, API credentials, ID tokens, refresh tokens, or R2 access keys.

## Configuration and identity

Development reads `.env`; installed apps read the path in `KAIRO_ENV_FILE`, or an app-user-data `.env`. Process environment variables take precedence. Firebase's web API key is public configuration, not an admin credential. AI access uses Claude Code's `settings.json` and Codex's `config.toml`; Kairo has no direct OpenAI API provider. Optional `KAIRO_CLAUDE_SETTINGS_FILE` and `KAIRO_CODEX_CONFIG_FILE` select native CLI files without copying credentials into application records.

Firebase REST uses `/v1/accounts:signUp`, `signInWithPassword`, `lookup`, and `sendOobCode`. Registration/sign-in sends `{email,password,returnSecureToken:true}`. Refresh uses `POST /v1/token` with URL-encoded `grant_type=refresh_token` and `refresh_token`. Only sanitized account identity is exposed to the renderer. Refresh tokens persist only if Electron safeStorage has OS encryption available. Sign-out clears the saved session and closes that user's cache.

## Firestore records

Records live under `users/{uid}/records/{type}--{id}`. Fields: `type`, `id`, serialized `payload`, `chunks`, `deleted`, `schemaVersion:1`, and server `modifiedAt`. Large payloads are split into private `chunks/{generation}-{index}` documents; one commit writes chunks, switches the parent and removes old chunks atomically. Records are limited to 6 MB. Conversation attachments are small R2 references.

Writes use `currentDocument.exists=false` for new records or `currentDocument.updateTime` for existing records. Failed preconditions become visible conflicts; users choose their device or cloud version. Deleted records retain tombstones. Cache and outbox are partitioned by UID. Sync runs 600 ms after edits and polls every 15 seconds. Queries fetch records whose `modifiedAt` is after the last server read-time snapshot; unchanged payloads are not fetched again. Pagination uses the same snapshot to avoid losing concurrent writes.

Owner checks and schema validation are in `firestore.rules`. Deploy those rules before production use. Mock tests do not establish deployed rules behavior.

## R2 Worker

Wrangler binds the private bucket as `BUCKET`. `FIREBASE_PROJECT_ID` must match the app's `KAIRO_FIREBASE_PROJECT_ID`. `GET /health` returns `{service:"kairo-storage",firebaseConfigured,bucketConfigured}` with 200 when both bindings are present, otherwise 503. Health responses contain no credentials.

`/v1/objects/{kind}/{id}`, where `kind` is `attachments` or `backups`. All requests require a Firebase ID token in `Authorization: Bearer <token>`.

- `PUT`: raw bytes, required Content-Length, supported Content-Type, maximum 24 MB; returns 201 and `{objectKey,size,etag}`.
- `GET`: bytes with private/no-store caching, ETag, Content-Length and Content-Type; 404 if missing.
- `HEAD`: metadata without a body.
- `DELETE`: deletes the caller's object and returns 204.
- Errors: 400 declared/body length mismatch, 401 unauthorized, 404 invalid/missing path, 405 unsupported method, 411 unknown length, 413 oversized body, 415 unsupported type, 503 unavailable storage. PUT reads are bounded and verify the actual byte count before writing an object.

The Worker verifies RS256 signatures using Google's Firebase JWKs, audience, issuer, expiration, issue time, authentication time and subject. It derives bucket keys as `{verified_uid}/{kind}/{id}` and accepts neither client user IDs nor bucket credentials. No public bucket URL is required. The desktop maintains a bounded 24 MB memory cache.

Cloud backups use scrypt-derived AES-256-GCM with a random salt, nonce and authentication tag. The passphrase comes from `KAIRO_BACKUP_PASSPHRASE`. Backups contain account records and R2 references; they do not duplicate attachment objects or contain API credentials.

## Verification limits

`npm run verify:cloud` checks the configured live Worker health, unauthenticated denial and Firebase authentication availability without creating accounts or data. `npm run verify:cloud -- --write-checks` additionally uses disposable accounts and objects to verify registration, login, refresh, Firestore reads/writes, owner/schema rules, preconditions, R2 PUT/HEAD/GET/DELETE, object isolation and encrypted backup restore. Cleanup runs before reporting success. Reports in `test-results/cloud-verification.json` contain check names and error codes, with no keys, tokens or generated passwords. Local contract verification is covered by `tests/cloud-verification.test.js`; it does not prove production deployment.

`tests/cloud.test.js` and `tests/worker.test.js` exercise client serialization, Firestore fields, optimistic writes, account isolation, offline edits, conflicts, Unicode chunking, cached objects, JWT verification and backup integrity using in-process contract doubles. DOM UI tests exercise renderer controls and an IPC fixture; they do not run native Electron windows.

Postman mocks and a simulation are in `postman/`. The simulation cannot bind a port in this sandbox (EPERM); official documentation fetches also failed due to DNS restrictions. All 20 deployed Firebase/R2 checks passed in the user’s terminal on 2026-10-31; the report is preserved in `test-results/cloud-verification.json`. The user also confirmed a Codex live response. Emulator execution, live Claude/GitHub/research and native platform checks remain delegated to the user in `docs/USER_CHECKS.md`.

## Native CLI response verification

`npm run verify:cli -- --provider claude` verifies a real response through the selected native settings file. `--timeout 10–600` changes the diagnostic timeout; `--safe-mode` is an optional Claude-only troubleshooting run that disables customizations without changing the user's files. Diagnostics print only gateway hostname, model mapping, customization presence and timeout phase, excluding tokens and hook commands. Authentication status is independent of a successful response from a custom gateway.

The transport accepts terminal Claude `result` and Codex `turn.completed` events as completion, including usage/error handling. It closes stdin and gives the child one second to exit before terminating the process tree. Post-response hooks cannot turn an already completed request into a timeout. Timeout errors distinguish startup, initialized request and partial response; fixture subprocess tests verify these phases and terminal-event cleanup. These local checks do not establish live gateway availability.

## Active provider on this device

`KAIRO_ACTIVE_PROVIDER=codex` makes Codex the default and restricts provider selection, request dispatch and health polling to Codex profiles. The preference applies when saved cloud settings still select Claude. It changes the runtime view without replacing stored native configurations or conversation history. Calls to inactive providers are rejected; their scheduled tasks do not run while this preference is set. Clear the value and restart to restore normal provider switching. CLI verification uses the active native provider by default; an explicit `--provider` remains available for later diagnostics.
