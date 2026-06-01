---
name: Judith auth flow
description: How Judith's email+password / OAuth / password-reset auth is wired in the Expo app, and the routing constraint that makes the reset flow work.
---

# Judith auth flow

Auth uses Supabase directly (no expo-auth-session / apple-authentication packages — only `expo-web-browser` + `expo-linking` are installed). The login screen is a social-first layout (Continue with Apple / Google, divider "or use email", email+password, Forgot password, Log in / Create account toggle). The OTP flow was removed because Supabase's default email template sends a confirmation **link** (ConfirmationURL), never a 6-digit token.

## OAuth (native pattern)
`signInWithOAuth({ provider, options: { redirectTo: Linking.createURL("auth/callback"), skipBrowserRedirect: true } })` → open the returned `data.url` with `WebBrowser.openAuthSessionAsync(url, redirectTo)` → parse the returned redirect URL manually: `?code=` → `exchangeCodeForSession`; `#access_token&refresh_token` → `setSession`. `WebBrowser.maybeCompleteAuthSession()` must be called at module top.

## Password reset routing race (load-bearing)
The reset link opens `app/(auth)/reset.tsx` via deep link. Establishing the recovery session publishes a real `session`, which would flip the router's `!session` guard and eject the user off the reset screen before they set a new password.

**Fix:** an `recoveryActive` flag in `AuthContext` gates routing. It MUST be set to `true` *before* calling `exchangeCodeForSession`/`setSession` (and cleared on failure), because `onAuthStateChange` can publish `session` first — setting the flag after the await reintroduces the eject race. Cleared on `updatePassword` success and `signOut`.

**How to apply:** the three `Stack.Protected` guards in `app/_layout.tsx` must stay in lockstep: tabs `isOnboarded = session && onboarded && !recoveryActive`; onboarding `session && !onboarded && !recoveryActive`; auth `!session || recoveryActive`. Any new top-level group must also exclude `recoveryActive` or it will hijack the reset screen.

OAuth/Apple/Google also require the providers ENABLED in the Supabase dashboard and the `Linking.createURL(...)` callback URIs added to the redirect allow-list — wiring works regardless, but sign-in fails until those are configured there.
