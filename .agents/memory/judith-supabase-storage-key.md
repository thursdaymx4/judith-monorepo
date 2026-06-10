---
name: Judith Supabase storage key
description: Why sessions vanish after OTA updates and how the storageKey pin prevents it
---

## Rule
Always set `storageKey: "judith-auth-token"` in the Supabase `createClient` auth options. Never let the SDK derive it from the URL hostname.

**Why:** The Supabase JS SDK derives its SecureStore/AsyncStorage slot from the first segment of the URL hostname:
- `https://login.judithforduedates.com` → `sb-login-auth-token`
- `https://prbistbxadydyuxdaaex.supabase.co` → `sb-prbistbxadydyuxdaaex-auth-token`

The native EAS build bakes `EXPO_PUBLIC_SUPABASE_URL=https://login.judithforduedates.com` (from `eas.json`). OTA bundles built from Replit inherit the Replit secret, which may be the raw project URL. Every OTA update silently "forgot" sessions because it looked in a different storage slot, and sign-in also broke because the PKCE code-verifier was written under one key but read under another.

**How to apply:** `storageKey: "judith-auth-token"` is already set in `artifacts/judith/lib/supabase.ts`. Do NOT remove it. If you ever recreate the Supabase client, add it back.

The dev script in `package.json` also explicitly pins `EXPO_PUBLIC_SUPABASE_URL=https://login.judithforduedates.com` so OTA bundles and native builds always agree on the URL as well (belt-and-suspenders).

**Recovery note:** Users who received the broken OTA bundle need to sign out and back in once to migrate their session to the new fixed key. After that sign-in, everything is stable across all future OTA updates.
