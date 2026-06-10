---
name: GCS static import blocks Cloud Run startup
description: Static import of @google-cloud/storage causes ~60s hang at Node.js ESM startup in Cloud Run, preventing app.listen() from being reached.
---

## Rule
Never statically import `@google-cloud/storage` (or any `@google-cloud/*` package) in a file that is imported at server startup.

**Why:** esbuild externalizes `@google-cloud/*` (not bundled). In Cloud Run (and likely other GCP runtimes), Node.js ESM resolves all static imports before running any code. The `@google-cloud/storage` module-level init probes the GCP metadata server at `http://169.254.169.254`. This request either blocks indefinitely or times out after ~60 seconds — matching the Replit autoscale startup timeout exactly. The server process is killed (SIGTERM) before `app.listen()` is ever called. Port detection shows "detected=1" (only the other artifact opened) and health checks return 500 throughout.

**How to apply:**
- In `audioCache.ts` (and any similar GCS-touching file), use `import type { Storage }` for the TypeScript type only.
- Inside `getBucket()` (or any lazy factory), use `const { Storage: StorageCls } = await import("@google-cloud/storage")`.
- Make `getBucket()` async; update all callers with `await getBucket()`.
- esbuild converts `await import(...)` to a dynamic require that only executes when the function is called — well after `app.listen()`.
