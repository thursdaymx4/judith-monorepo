---
name: Judith Apple sign-in (native vs web)
description: Why Apple sign-in uses NATIVE Sign in with Apple, not the Supabase web-OAuth flow, and what each flow depends on.
---

# Apple sign-in: native, not web-OAuth

Apple sign-in is implemented as **native Sign in with Apple** (`expo-apple-authentication` →
`supabase.auth.signInWithIdToken({ provider: "apple" })`). Google still uses the Supabase
web-OAuth flow; Apple keeps the web flow only as a non-iOS fallback.

**Why:** The web-OAuth Apple flow sends users back to `<SUPABASE_URL>/auth/v1/callback`.
Once `EXPO_PUBLIC_SUPABASE_URL` became the custom domain `login.judithforduedates.com`,
that return URL must be registered AND the domain verified in the Apple Services ID
(`com.app.judith.auth`). Apple verifies a domain by fetching
`/.well-known/apple-developer-domain-association.txt` from it — but that host is
Supabase-controlled (it 404s, on both the custom and the old `*.supabase.co` domain),
so you cannot host the file → the custom-domain return URL can never be verified →
web-flow Apple dies with "Sign Up Not Completed". Native flow sidesteps all of this:
it authenticates against the **bundle ID** `com.app.judith` and is independent of the
Supabase URL, so the branded custom domain can stay for Google.

**How to apply:**
- Do NOT try to "just add the new return URL" in the Apple Developer portal for the
  custom domain — verification will fail. Use the native flow.
- Native flow requires, in the **Supabase dashboard → Auth → Providers → Apple**, the
  app **bundle ID** `com.app.judith` added to the authorized client IDs list (alongside
  the Services ID used by the web flow). Without it, `signInWithIdToken` rejects the token.
- `EXPO_PUBLIC_*` are baked at build time, and `expo-apple-authentication` is a native
  module — any change here needs a fresh EAS dev/prod build; it cannot be OTA-updated.
- Nonce: generate a raw nonce, send its SHA-256 hash to `AppleAuthentication.signInAsync`,
  send the RAW nonce to Supabase `signInWithIdToken`. Swallow `ERR_REQUEST_CANCELED`.
- `app.json` needs `ios.usesAppleSignIn: true` + the `expo-apple-authentication` plugin.

## Cannot be tested in Expo Go

In **Expo Go**, native Apple sign-in returns an id_token whose audience (`aud`) is
`host.exp.Exponent` (Expo Go's own bundle ID), not `com.app.judith`. Supabase then
rejects it with: `Unacceptable audience in id_token: [host.exp.Exponent]`.

**Why:** Expo Go runs the JS under Expo's app identity/entitlements, so Apple issues the
token to Expo Go, not to our app. There is NO code fix — it's a runtime-environment limit.

**How to apply:** Test native Apple sign-in only in a **dev build** (expo-dev-client) or a
standalone/TestFlight EAS build, where `aud` = `com.app.judith` (already in the Supabase
Apple Client IDs). Do NOT add `host.exp.Exponent` to the production Client IDs to make
Expo Go work — that lets any Expo Go app mint accepted tokens (security hole). Use a build.
