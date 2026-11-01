# Changelog

## 0.2.1

- Add first-run backend setup for installed apps. Users enter their own Firebase settings and optional R2 Worker URL without an environment file.
- Save backend configuration locally and reload it automatically at startup.
- Protect saved settings and optional backup passphrases with OS secure storage when available.
- Require sign-out before changing backends, and keep private configuration out of workspace exports and sync.
- Update setup docs for DMG/EXE users.
- Isolate the native Swift module cache by project path so a copied checkout can rebuild its helpers.
