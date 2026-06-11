---
name: Replit deployment proxy blocks SSE
description: Replit autoscale deployment proxy silently drops all SSE/streaming HTTP connections — never use stream:true for production ask.
---

# Replit autoscale deployment proxy blocks SSE

**Rule:** Never use SSE/streaming (`stream:true`) for the `/ask` endpoint in production. The Replit autoscale deployment proxy silently drops streaming connections — the request never reaches the server process (no deployment log entry, no response headers, client gets immediate network error).

**Why:** Confirmed June 2026. curl with both HTTP/2 and HTTP/1.1 to the production URL with `stream:true` received zero response even after 15 seconds, while `stream:false` returned 200 in 4.4s. Deployment logs show non-streaming requests logged but streaming requests completely absent.

**How to apply:** Ask endpoint must always use the non-streaming JSON path (`stream:false` or omit `stream` field) in production. Streaming can be used in local dev (hits the dev workflow server directly via Replit tunnel, which does support SSE). If streaming UX is desired in a future build, it requires a proxy config change or a different hosting approach — not a code change alone.
