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
return a GoTrue JSON 200; an HTML body means the URL is wrong.
