---
name: Judith legal page URLs
description: How in-app Terms/Privacy links must be formed to match the deployed privacy SPA
---

The public Privacy Policy + Terms of Use are one Vite SPA (the `privacy` artifact). It is deployed at `https://judithforduedates.com/privacy` and selects the page with a `?page=privacy` / `?page=terms` query param (router in `privacy/src/App.tsx`).

**Rule:** in-app legal links (Judith `constants/legal.ts`, App Store metadata) must use the `?page=` query form, NOT a clean `/terms` path.

**Why:** the host serves the SPA only under `/privacy` with no clean-path rewrite — `https://judithforduedates.com/terms` returns 404. The router also accepts a `/terms` pathname, but only if the host rewrites it to the SPA entry, which it currently does not.

**How to apply:** keep `TERMS_URL = .../privacy?page=terms` and `PRIVACY_URL = .../privacy?page=privacy`. If clean paths are ever wanted, add a host rewrite for `/terms` → SPA entry first, then verify both URLs return 200 before switching the constants.
