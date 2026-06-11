---
name: Judith OTA env var requirement
description: EXPO_PUBLIC_* vars must be set as Replit shared env vars AND prefixed on every eas update command or OTA bundles get BASE=undefined.
---

# Judith OTA env var requirement

**Rule:** Always set `EXPO_PUBLIC_DOMAIN=judithforduedates.com` BOTH as a Replit shared env var AND as an inline prefix on every `eas update` command.

**Why:** Metro bakes `process.env.EXPO_PUBLIC_*` into the JS bundle at build time. OTA (`eas update`) re-runs Metro to produce a new bundle. If `EXPO_PUBLIC_DOMAIN` is not set in the shell environment when `eas update` runs, Metro inlines `undefined` → `BASE = "https://undefined/api/judith"` → all API calls silently fail with network errors. The Replit shared env var covers the dev server; the inline prefix covers OTA bundles.

**How to apply:** Every OTA push must be:
```
EXPO_PUBLIC_DOMAIN=judithforduedates.com npx eas update --channel production --message "..." --non-interactive
```
Run from `artifacts/judith/`.
