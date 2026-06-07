---
name: Replit GCS sidecar auth
description: How to authenticate @google-cloud/storage inside a Replit workflow — plain new Storage() fails; sidecar at port 1106 required.
---

# Replit GCS Sidecar Authentication

## Rule

Never use `new Storage()` with no arguments in a Replit workflow. It fails with "Could not load the default credentials." Always pass the external_account credential config pointing to the Replit sidecar.

```typescript
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});
```

**Why:** Replit does not inject GOOGLE_APPLICATION_CREDENTIALS or a GCP metadata server. GCS auth is delegated to a local sidecar process at `127.0.0.1:1106` that exposes `/credential` (returns `{"access_token":"..."}`) and `/token`. This sidecar runs as part of each workflow — it IS available from plain shell too (curl 127.0.0.1:1106/credential works).

**How to apply:** Any server code using `@google-cloud/storage` (audioCache, objectStorage, etc.) must use this pattern. The object-storage skill's `objectStorage.ts` template already has this — use it as the reference. When silent GCS failures occur (writes silently swallowed by catch {}), the first thing to check is whether this sidecar config was used.

## Debugging tip

To verify GCS works from the shell:
```bash
curl -s http://127.0.0.1:1106/credential   # should return {"access_token":"..."}
```
If that returns JSON, the sidecar is up and the Storage config above will work.
