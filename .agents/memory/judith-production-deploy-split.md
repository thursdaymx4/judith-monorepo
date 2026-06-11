---
name: Judith production deploy split
description: Where the live app actually runs and why Replit fixes don't reach production automatically
---

# Judith production / deploy topology

The mobile app's production API base is a SEPARATE Google Cloud server at
`https://judithforduedates.com/api/judith` (resolves to a Google Frontend,
`x-powered-by: Express`), NOT the Replit deployment. Curl tests confirm the GCP
server serves SSE + TTS fine for anonymous/invalid-token asks.

**Why this matters:** Any server-side fix made in the Replit repo does NOT reach
the live app until either (a) the GCP server is redeployed with the new code, or
(b) DNS for `judithforduedates.com` is repointed to the Replit deployment. Don't
assume a Replit server change is "live."

**OTA / client fixes:** Updates are shipped via `eas update --channel production`,
which is run from the USER'S MAC (Replit has no EAS token or Apple creds, so it
cannot push OTA). The Mac codebase can diverge from the Replit repo because the
user also runs other agents (e.g. Codex) locally in Xcode. Replit `main` can be
several commits ahead of `github-sync/main`; the Mac pulls from GitHub. So a
client fix committed on Replit only reaches the app if it is synced to the Mac
(GitHub pull, discarding/reconciling local changes) BEFORE the user runs eas
update.

**Ask auth quirk:** The signed-in path used to send `Authorization: Bearer`
on `/ask`; the live GCP server errors on the authenticated path while handling
anonymous asks correctly. `askJudithStream` now sends NO auth header (bills come
from the client body, so the server needs no identity). Onboarding ask
(`askOnboarding`) never sent auth, which is why it kept working.

**How to apply:** When the user reports "the fix didn't work in the app,"
first check whether the change is (1) only in the Replit repo, (2) synced to the
Mac/GitHub, and (3) actually OTA-pushed — and whether the broken behavior is
server-side (GCP, not Replit). Diagnose the layer before re-editing code.
