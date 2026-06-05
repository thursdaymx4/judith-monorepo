---
name: Judith Supabase URL config
description: EXPO_PUBLIC_SUPABASE_URL must be the project API origin, not the dashboard URL; symptom + self-heal.
---

# Supabase URL must be the API origin, not the dashboard URL

`EXPO_PUBLIC_SUPABASE_URL` must be `https://<ref>.supabase.co` (the project
API origin). A common paste mistake is the **dashboard** URL
`https://supabase.com/dashboard/project/<ref>`.

**Symptom:** login "Send code" (`supabase.auth.signInWithOtp`) throws
`JSON Parse error: Unexpected character: <`. The `<` is supabase.com's HTML
404 page being fed to `JSON.parse`. In general, a `JSON parse "<"` from any
fetch means an HTML page came back from a wrong/misrouted URL, not JSON.

**Why self-heal in code:** secrets cannot be set programmatically, so
`normalizeSupabaseUrl()` in `lib/supabase.ts` converts a dashboard URL to
`https://<ref>.supabase.co`, strips any path to the origin otherwise, and
returns undefined on malformed input (fails fast as "not configured").

**How to verify a URL without the inbox:** `GET <url>/auth/v1/health` should
return a GoTrue JSON 200 (or a 401 "No API key" — also a healthy sign the
endpoint is alive). An HTML body means the URL is wrong.

**A Supabase custom domain is a valid value** (e.g. `https://login.<brand>.com`)
— it passes `normalizeSupabaseUrl` (returns `.origin`) and serves the same
`/auth/v1` + `/rest/v1` endpoints with the same anon key. Reason to use one: the
native OAuth consent dialog shows the branded host instead of the raw
`<ref>.supabase.co`.

**The URL lives in THREE lockstep locations** — change all together or builds
diverge from dev: the `EXPO_PUBLIC_SUPABASE_URL` secret (dev; secrets can't be
set programmatically, request from user), `eas.json` (preview + production env),
and `build.sh` (preview + production env). When swapping to a custom domain, also
add `https://<domain>/auth/v1/callback` to the Google OAuth client's authorized
redirect URIs (keep the old one during transition).
