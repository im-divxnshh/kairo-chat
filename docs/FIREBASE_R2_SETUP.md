# Firebase, environment and Cloudflare R2 setup

## Configure Firebase

1. Create or choose a Firebase project.
2. Register a web app and copy its configuration values.
3. Enable Email/Password in Authentication → Sign-in method.
4. Create Cloud Firestore in production mode.
5. Install Firebase CLI and deploy the supplied security rules:

```sh
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

The desktop and Worker must use the same project ID. This app uses the `(default)` database. No service-account private key is needed.

## Create private R2 storage

Create a private R2 bucket in your Cloudflare account, for example `kairo-private`. Install Wrangler, then from `cloudflare/`:

```sh
wrangler login
# Update bucket_name in wrangler.toml to your actual bucket.
wrangler secret put FIREBASE_PROJECT_ID
wrangler deploy
```

Enter your Firebase project ID when prompted. Wrangler supplies the private R2 binding; R2 access keys are never embedded in the app. Save the deployed Worker URL. The app uses your existing Firebase project, Worker and private R2 bucket. The bucket binding must be named `BUCKET`.

## Fill the desktop environment

Your private `.env` supplies these values (the tracked `.env.example` is a blank template):

```dotenv
KAIRO_FIREBASE_API_KEY=your-public-firebase-web-api-key
KAIRO_FIREBASE_PROJECT_ID=your-project-id
KAIRO_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
KAIRO_FIREBASE_APP_ID=your-web-app-id
KAIRO_R2_WORKER_URL=https://your-worker.your-subdomain.workers.dev
KAIRO_BACKUP_PASSPHRASE=a-unique-passphrase-at-least-16-characters
# Optional native CLI file overrides
KAIRO_CLAUDE_SETTINGS_FILE=
KAIRO_CODEX_CONFIG_FILE=
# Optional: restrict this device to Codex for now. Clear to enable switching.
KAIRO_ACTIVE_PROVIDER=codex
```

Then run:

```sh
npm install
npm start
```

Create an account or sign in. The account menu sends verification emails. Provider settings support CLI executable paths, `settings.json` / `config.toml` paths, and optional model overrides. Leave model overrides empty to honor your CLI configuration. No OpenAI API key is needed. CLI authentication remains separate from Firebase login.

Never distribute a shared `.env`, provider credentials or R2 access keys. Installers exclude environment files. For an installed app, set `KAIRO_ENV_FILE` to the absolute path of your private file, or place `.env` in the app's user-data directory. Restart after changing variables. Process environment values override the file.

## Verify the deployment

From the repository root, after `firebase login` and `npx wrangler login`:

```sh
npm run deploy:cloud
npm run verify:cloud
npm run verify:cloud -- --write-checks
```

The deployment command uploads the supplied Firestore rules to the project from `.env`, deploys to your existing Worker URL, and sets its `FIREBASE_PROJECT_ID`. It retains the actual bucket named in `cloudflare/wrangler.toml`. The read-only verifier checks configuration and connectivity. Full checks create disposable accounts, test Firestore owner/schema enforcement and preconditions, exercise R2 upload/download/metadata/deletion and encrypted backup restore, and clean up. The report is written to `test-results/cloud-verification.json` without credentials.

Run these in a terminal with network access. A DNS failure in the Codex workspace does not establish that your deployed services are broken. Package the app only after live checks pass.

Use two test accounts to verify file isolation. Check that a conversation appears on another device with the same account. Edit a record on two devices while one is offline and resolve the resulting conflict. Create and restore an encrypted R2 backup. The local test suite does not replace these checks.

For Firebase emulators:

```sh
firebase emulators:start --only auth,firestore --project demo-kairo
```

Configure both emulators together:

```dotenv
KAIRO_FIREBASE_API_KEY=emulator-key
KAIRO_FIREBASE_PROJECT_ID=demo-kairo
KAIRO_FIREBASE_AUTH_EMULATOR=http://127.0.0.1:9099
KAIRO_FIREBASE_FIRESTORE_EMULATOR=http://127.0.0.1:8080
```

The production R2 Worker rejects unsigned emulator tokens. Leave R2 unset for text-only emulator work or use the contract simulation for R2 client testing. Do not weaken production verification.

## Performance

Attachments upload once and are referenced from Firestore. Repeated previews reuse a bounded cache. Sync fetches changed records by server timestamp. Streaming updates the active response at most every 33 ms. These reduce work and transfers; live-network latency has not been benchmarked.
